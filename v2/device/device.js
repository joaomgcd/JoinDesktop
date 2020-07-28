import { Sender,SenderServer,SenderGCM,SenderIP,SenderIFTTT,SenderLocal,SendResults,SenderWebSocket,SenderMyself } from '../api/sender.js';
import {GCMLocalNetworkTestRequest, GCMPush, GCMRequestFile, GCMRespondFile, GCMSmsSentResult, GCMLocalNetworkTest,GCMLocalNetworkRequest,GCMFolderRequest, GCMFolder, GCMWebSocketRequest} from '../gcm/gcmapp.js'
import { AppContext } from '../appcontext.js'
import '../extensions.js';
import { EventBus } from "../eventbus.js";




const SHARED_PREFIX = "shared.";
const deviceTypeGroups = ["all","android","chrome","windows10",/*"firefox",*/"phone","tablet","pc"];
export class Devices extends Array{
	static get TYPE_ANDROID_PHONE() {return 1;}
	static get TYPE_ANDROID_TABLET() {return 2;}
	static get TYPE_CHROME_BROWSER() {return 3;}
	static get TYPE_WINDOWS_10() {return 4;}
	static get TYPE_TASKER() {return 5;}
	static get TYPE_FIREFOX() {return 6;}
	static get TYPE_GROUP() {return 7;}
	static get TYPE_ANDROID_TV() {return 8;}
	static get TYPE_GOOGLE_ASSISTANT() {return 9;}
	static get TYPE_IOS_PHONE() {return 10;}
	static get TYPE_IOS_TABLET() {return 11;}
	static get TYPE_IFTTT() {return 12;}
	static get TYPE_IP() {return 13;}
	static get TYPE_MQTT() {return 14;}
	constructor(initial){
		if(Number.isInteger(initial)){
			super(initial);
			return;
		}
		const devicesRaw = initial || [];
		super();
		const devices = devicesRaw.map(deviceRaw=>Device.getDevice(deviceRaw));
		devices.forEach(device=>this.push(device));
		this.sortByMultiple(
			true,
			device => !device.isMyDevice,
			device => device.isGroup,
			device => device.isShared,
			device => device.deviceType,
			device => device.deviceName
		)
	}
	transferSockets(toOtherDevices){
		this.forEach(thisDevice=>{
			if(!thisDevice.socket) return;

			const otherDevice = toOtherDevices.find(otherDevice => otherDevice.deviceId == thisDevice.deviceId);
			if(!otherDevice) return;

			otherDevice.socket = thisDevice.socket;
		});
	}
	getDevice(deviceId){
		if(!deviceId) return null;

		return this.find(device=>device.deviceId == deviceId);
	}
	async testLocalNetworkDevices(){

		const devicesToCheckLastKnown = this.filter(device=>device.hasLocalNetworkCapabilities);
		
		const lastKnownChecks = devicesToCheckLastKnown.map(async device=>{
			const success = await device.testLocalNetworkLastKnownAndGoogleDrive();
			return {device,success};
		})
		const lastKnownResults = await Promise.all(lastKnownChecks);
		console.log("Last Known Checks Results.", lastKnownResults);

		const failedDevices =  new Devices(lastKnownResults.filter(result => !result.success).map(result=>result.device));
		if(failedDevices.length == 0){
			console.log("All local network tests are a success!!");
			return;
		}
		console.log("Testing non successes and not tested",failedDevices);

		const gcm = new GCMLocalNetworkTestRequest();
		failedDevices.forEach(async device=>await device.setToRemoteNetwork(false));
		return await failedDevices.send(gcm);
	}
	async sendPush(push){
		if(!push.id){
			push.id = Sender.newMessageId;
		}
		push.senderId = AppContext.context.getMyDeviceId();
		const gcmPush = new GCMPush();
		gcmPush.push = push;
		return await this.send(gcmPush);
	}
	async send(options){
		if(options.encrypt){
			await options.encrypt();
		}
		await options.storeGcmRaw();
		if((await options.gcmRaw).json.length > 3500){
			options.forceServer = true;
		}
		var groupsBySender = null;
		if(options.forceServer){
			groupsBySender = this.groupBy(device=>true);
		}else{
			groupsBySender = this.groupBy(device=>device.senderClass);	
		}
		const isPush = (await options.gcmRaw).type == "GCMPush";
		const results = await Promise.all(groupsBySender.map(async group=>{
			const sender = options.forceServer ? new SenderServer() : new group.key();
			options.devices = group.values;
			if(!isPush){
				options.devices = options.devices.filter(device=>!device.onlySendPushes);
			}else{
				options.gcmPush = JSON.parse((await options.gcmRaw).json);
			}
			if(options.devices.length == 0) return Promise.resolve(Sender.newSuccessResult)

			options.gcmParams = {};
			try{
				return await sender.send(options);
			}catch(error){
				if(!Util.isType(sender,"SenderLocal")) throw error
				
				options.devices.forEach(async device=>{
					await device.setToRemoteNetwork(true)
				});
				return await this.send(options);
			}
		}));
		return SendResults.fromMany(results)
	}
	async uploadFile({file,token}){
		const result = await this.uploadFiles({files:[file],token});
		if(!result || result.length == 0) return null;

		return result[0];
	}
	async uploadFiles({files,token}){
		if(this.length == 0) return [];

		files = Array.from(files);
		const canAllSend = this.every(device=>device.canContactViaLocalNetwork);
		const failedDevices = new Devices();
        if(canAllSend){
			const results = [];
			for(const device of this){
				const uploadedFiles = await Promise.all(files.map(async file =>{
					try{
						const result = await device.uploadFileLocalNetwork({file,token});
						return result.payload[0].path;
					}catch(error){
						failedDevices.push[device];
						device.canContactViaLocalNetwork = false;
						console.log(`Couldn't upload via local network for ${device}`);
						return null;
					}
				}));
				
				results.push({device,files:uploadedFiles.filter(uploadedFile=>uploadedFile ? true : false)});
			}
			if(failedDevices.length == 0){
				return results;
			}
			return await failedDevices.uploadFiles({files,token});
		}else{
			const device = this[0];
			const uploadedFiles = await device.uploadFilesGoogleDrive({files,token});
			return this.map(device=>{
				return {device,files:uploadedFiles};
			});
		}
		
	}
	async pushFiles(args = {files,path,token}){
		const results = await this.uploadFiles(args);
		const groupedByDevice = results.groupBy(result=>result.device);
		for(const group of groupedByDevice){
			const device = group.key;
			const files = group.values.map(value=>value.files).flat();
			await device.sendPush({files,filePath:args.path})
		}
	}
	async pushFile({file,path,token}){
		await this.pushFiles({files:[file],path,token})
	}
}
export class Device{
	async uploadFileLocalNetwork({file,token}){
		if(!this.canContactViaLocalNetwork) throw `Can't upload file via local network for ${this.deviceName}`;

		const options = {
            method: 'POST',
            body: file,
            headers: {
                "Content-Disposition": `filename="${file.name}"`
              }
		}
		const serverAddress = this.localNetworkServerAddress;
        const url = `${serverAddress}files?token=${token}`; 
        console.log(`Uploading ${file.name} to ${serverAddress}...`);
        const result = await fetch(url,options);
        console.log(`Uploading ${file.name} to ${serverAddress} done!`);
        return result.json();
	}
	async uploadFilesGoogleDrive({files,token}){
		const googleDrive = new GoogleDrive(()=>token);
		const uploadedFiles = await googleDrive.uploadFiles({
			folderName: GoogleDrive.getBaseFolderForMyDevice(),
			accountToShareTo:this.userAccount,
			notify: false
		}, files);

		return uploadedFiles.map(uploadedFile=>GoogleDrive.getDownloadUrlFromFileId(uploadedFile));
	}
	async uploadFile(args = {file,path,token}){
		const result = await this.asDevices.uploadFile(args);
		return result.files[0];
	}
	async uploadFiles(args = {files,path,token}){
		const results = await this.asDevices.uploadFiles(args);
		return results.map(result=>result.files).flat();
	}
	async pushFile(args = {files,token}){
		await this.asDevices.pushFile(args);	
	}
	async pushFiles(args = {files,token}){
		await this.asDevices.pushFiles(args);
	}
	get senderClass(){
		if(this.isMyDevice) return SenderMyself;
		if(this.socket) return SenderWebSocket;
		if(this.canContactViaLocalNetwork) return SenderLocal;
		if(this.isGCM) return SenderGCM;
		if(this.isIP) return SenderIP;
		if(this.isIFTTT) return SenderIFTTT;
		return SenderServer;
	}
	isAnyType(...types){
		for(const type of types){
			if(type === this.deviceType) return true;
		}
		return false;
	}	
	get isAndroid(){
		return this.isAnyType(Devices.TYPE_ANDROID_PHONE,Devices.TYPE_ANDROID_TABLET);
	}
	get isAndroidPhone(){
		return this.isAnyType(Devices.TYPE_ANDROID_PHONE);
	}
	get isAndroidTablet(){
		return this.isAnyType(Devices.TYPE_ANDROID_TABLET);
	}
	get isAndroid(){
		return this.isAndroidPhone || this.isAndroidTablet;
	}
	get isChromeExtension(){
		return this.isAnyType(Devices.TYPE_CHROME_BROWSER);
	}
	get isWindows10(){
		return this.isAnyType(Devices.TYPE_WINDOWS_10);
	}
	get isBrowser(){
		return this.isAnyType(Devices.TYPE_FIREFOX);
	}
	get isIOS(){
		return this.isAnyType(Devices.TYPE_IOS_PHONE, Devices.TYPE_IOS_TABLET);
	}
	get isGCM(){
		return this.isAndroid || this.isChromeExtension || this.isBrowser || this.isIOS;
	}
	get isIP(){
		return this.isAnyType(Devices.TYPE_IP);
	}
	get isIFTTT(){
		return this.isAnyType(Devices.TYPE_IFTTT);
	}
	get onlySendPushes(){
		return this.isIP || this.isIFTTT;
	}
	get asDevices(){
		const devices = new Devices();
		devices.push(this);
		return devices;
	}
	async send(options){
		return await this.asDevices.send(options);
	}
	async sendPush(push){
		return await this.asDevices.sendPush(push);
	}
	
	async sendFileRequest(type,timeout=100000,payload=null){
		const request = {
			"requestType": type,
			"senderId": AppContext.context.getMyDeviceId(),
			"deviceIds": [this.deviceId]
		};
		if(payload){
			request.payload = payload;
		}
		const gcm = new GCMRequestFile();
		gcm.requestFile = request;
		await this.send(gcm);	
	}
	
	async sendFileRequestAndWaitForResponse(type,timeout,payload=null){
		await this.sendFileRequest(type,timeout,payload);
		
		while(true){
			const response = await EventBus.get().waitFor(GCMRespondFile,timeout);
			if(!response.responseFile || !response.responseFile.request) return response;

			const requestType = response.responseFile.request.requestType;
			if(requestType == type) return response;
		}
		
	}
	async sendFileRequestAndOpen(type){
		const fileResponse = await this.sendFileRequestAndWaitForResponse(type);

		const response = fileResponse.responseFile;
		if(!response) return;

		const downloadUrl = response.downloadUrl;
		if(!downloadUrl) return;

		await Util.openWindow(downloadUrl);
	}
	async sendScreenshotRequest(){
		// if(this.canContactViaLocalNetwork){
		// 	Util.openWindow(`${this.localNetworkServerAddress}screen?download=1`);
		// }else{
			return await this.sendFileRequestAndOpen(GCMRequestFile.TYPE_SCREENSHOT);
		// }
	}
	async sendScreenCaptureRequest(){
		return await this.sendFileRequest(GCMRequestFile.TYPE_VIDEO);
	}
	async sendSMSThreadsRequest(){
		return await this.sendFileRequestAndWaitForResponse(GCMRequestFile.TYPE_SMS_THREADS);
	}
	async sendSMSConversationRequest(address){
		return await this.sendFileRequestAndWaitForResponse(GCMRequestFile.TYPE_SMS_CONVERSATION,15000,address);
	}
	async sendNotificationsRequest(){
		return await this.sendFileRequest(GCMRequestFile.TYPE_NOTIFICATIONS,15000);
	}
	async sendMediaInfosRequest(){
		return await this.sendFileRequest(GCMRequestFile.TYPE_MEDIA_INFOS,15000);
	}
	async sendFileListRequest(args={path}){
		const gcm = new GCMFolderRequest();
		gcm.senderId = AppContext.context.getMyDeviceId();
		gcm.path = args.path;
		await this.send(gcm);
		try{
			await EventBus.waitFor(GCMFolder,15000);
		}catch{}
	}
	
	getLoaderArgs(token,additional=null){
		const args = {deviceId:this.deviceId,token,device:this};
		Object.assign(args,additional);
		return args;
	}
	async loadSMSThreads({db,token,refresh}){
		const dbGoogleDriveArgs = this.getLoaderArgs(token)
		const SMSThreads =(await import("../sms/thread/smsthread.js")).SMSThreads;
		const Contacts = (await import("../sms/contacts.js")).Contacts;
		const loaderSMSThreads = SMSThreads.loader;

		try{
			dbGoogleDriveArgs.contacts = await this.loadContacts({db,token,refresh});
			const smsThreads = await loaderSMSThreads.load({db, refresh, dbGoogleDriveArgs})
			return smsThreads;
		}catch(error){
			this.reportStatus("SMS was not enabled on your device. Enabling now. Please check back in a while. Monitor progress on your Android device's notifications.");
			await this.sendSMSThreadsRequest();
			return new SMSThreads([],new Contacts([]),this.deviceId);
		}
	}
	async reportStatus(message){
		await EventBus.post(new StatusReport(message));
	}
	
	
	async loadContacts({db,token,refresh}){		
		const dbGoogleDriveArgs = this.getLoaderArgs(token)
		const Contacts = (await import("../sms/contacts.js")).Contacts;
		const loaderContacts = Contacts.loader;
			const contacts = await loaderContacts.load({db, refresh, dbGoogleDriveArgs});
			return contacts;
		
	}
	async loadSmsConversation({db,token,contact,refresh}){		
		const dbGoogleDriveArgs = this.getLoaderArgs(token,{contact})
		const SMSConversation = (await import("../sms/conversation/smsconversation.js")).SMSConversation
		const loaderConversation = SMSConversation.loader;
		var conversation = null
		try{
			conversation = await loaderConversation.load({db, refresh, dbGoogleDriveArgs});
		}catch(error){
			await this.reportStatus("Requesting Conversation from device...");
			console.log(error);
			try{
				await this.sendSMSConversationRequest(contact.address);
				conversation = await loaderConversation.load({db, refresh, dbGoogleDriveArgs});
			}catch{
				await alert(`Couldn't get conversation from ${this.deviceName}. Please check if it is online.`);
				return new SMSConversation([],this.deviceId,contact);
			}
		}
		// console.log(conversation);
		return conversation;
	}
	async loadNotifications({token}){
		if(!this.canSendNotifications()) return [];

		const dbGoogleDriveArgs = this.getLoaderArgs(token);
		const NotificationInfos = (await import("../notification/notificationinfo.js")).NotificationInfos;
		const loader = NotificationInfos.loader;
		return await loader.load({db, refresh, dbGoogleDriveArgs});
		// if(!this.canContactViaLocalNetwork){ 
		// 	await this.reportStatus(`Loading notifications remotely for ${this.deviceName}...`);
		// 	this.sendNotificationsRequest();
		// 	return [];
	    // }

		// const dbGoogleDriveArgs = this.getLoaderArgs(token);
		// await this.reportStatus(`Loading notifications from local network for ${this.deviceName}...`);
		// return await NotificationInfos.fromLocalNetwork(dbGoogleDriveArgs);
	}
	async loadFiles(args={token,subfolder}){
		const FileList = (await import("../files/files.js")).FileList;
		if(!this.canBrowseFiles()) return new FileList({device:this});

		const dbGoogleDriveArgs = this.getLoaderArgs(args.token);
		const loader = FileList.loader;
		Object.assign(dbGoogleDriveArgs,args)
		
		let result = await loader.load({db, refresh, dbGoogleDriveArgs});
		if(!this.canContactViaLocalNetwork){
			result = null;
		}
		return result;
	}
	async loadPushHistory(args = {token,getDevice}){
		const PushHistory = (await import("../pushhistory/pushhistory.js")).PushHistory;
		if(!this.canShowPushHistory()) return new PushHistory([],this);

		const dbGoogleDriveArgs = this.getLoaderArgs(args.token);
		Object.assign(dbGoogleDriveArgs,args)
		const loader = PushHistory.loader;
		
		try{
			let result = await loader.load({db, refresh, dbGoogleDriveArgs});
			return result;
		}catch(error){
			console.log("Couldn't load push history",error);
			return new PushHistory([],this);
		}
	}
	async openFile({token,path}){
		if(!this.canContactViaLocalNetwork){
			this.reportStatus(`Requesting file remotely from ${this.deviceName}. If the file is big this may take a while...`)
			this.sendFileListRequest({path})
			return;
		}
		const url = `${this.localNetworkServerAddress}files${path}?token=${token}`;
		return await Util.openWindow(url);
	}
	async loadMediaInfos({db,token,refresh}){
		if(!this.canBeMediaControlled()) return [];
		const dbGoogleDriveArgs = this.getLoaderArgs(token)
		const MediaInfos = (await import("../media/mediainfo.js")).MediaInfos;
		const loader = MediaInfos.loader;
		return await loader.load({db, refresh, dbGoogleDriveArgs});
		// const requestFromGoogleDrive = async () => {
		// 	try{
		// 		await this.reportStatus(`Loading media info remotely for ${this.deviceName}...`);
		// 		this.sendMediaInfosRequest();
					
		// 	}catch(error){
		// 		console.log("Couldn't request media info",error)
		// 	}
		// 	return [];
		// }

		// if(!this.canContactViaLocalNetwork){ 
		// 	return await requestFromGoogleDrive();
	    // }
		// await this.reportStatus(`Loading media info from local network for ${this.deviceName}...`);
		// try{
		// 	return await MediaInfos.fromLocalNetwork(dbGoogleDriveArgs);
		// }catch{
		// 	return await requestFromGoogleDrive();
		// }
		// const loader = MediaInfos.loader;
		// let mediaInfos = null;
		// try{
		// 	mediaInfos = await loader.load({db, refresh, dbGoogleDriveArgs});
		// 	return mediaInfos;
		// }catch(error){
		// 	await this.reportStatus(`Requesting Media Info from ${this.deviceName}...`);
		// 	try{
		// 		await this.sendMediaInfosRequest();
		// 		mediaInfos = await loader.load({db, refresh, dbGoogleDriveArgs});
		// 	}catch{
		// 		await this.reportStatus(`Couldn't get media infos from ${this.deviceName}. Please check if it is online.`);
		// 		return new MediaInfos([],this);
		// 	}
		// }
	}
	async setMediaVolume(mediaVolume){
		await this.sendPush({mediaVolume});
	}
	async pressPlay(packageName){
		await this.sendPush({play:true,mediaAppPackage:packageName});
	}
	async pressPause(packageName){
		await this.sendPush({pause:true,mediaAppPackage:packageName});
	}
	async pressNext(packageName){
		await this.sendPush({next:true,mediaAppPackage:packageName});
	}
	async pressBack(packageName){
		await this.sendPush({back:true,mediaAppPackage:packageName});
	}
	async searchAndPlayMedia({packageName,query}){
		await this.sendPush({mediaSearch:query,mediaAppPackage:packageName});
	}
	async sendSMS({senderId,smsMessage,token}){
		if(!this.canReceiveSms()) return;

		if(Util.isFile(smsMessage.mmsfile)){
            this.reportStatus("Attaching file...");
            smsMessage.mmsfile = await this.uploadFile({file:smsMessage.mmsfile,token})
            this.reportStatus(null);
		}
		try{		
			await this.sendPush({
				senderId,
				smsnumber:smsMessage.address,
				smstext:smsMessage.text,
				mmsfile:smsMessage.mmsfile,
				mmssubject:smsMessage.mmssubject,
				mmsurgent:smsMessage.mmsurgent,
				requestId:"SMS",
				responseType: GCMPush.RESPONSE_TYPE_PUSH
			});
			const gcm = await EventBus.waitFor(GCMSmsSentResult,15000);
			return gcm;
		}catch(e){
			const gcm = new GCMSmsSentResult();
			gcm.success = false;
			if(!e){
				e = "Timed out while waiting to send";
			}
			gcm.errorMessage = e;
			return gcm;
		}
	}
	async call(number){
		if(!this.canReceiveSms()) return;
		
		return await this.sendPush({callnumber:number});
	}
	static getDevice(deviceRaw){
		var device = null;
		if(deviceRaw.deviceType == Devices.TYPE_ANDROID_PHONE){
			device = new DeviceAndroidPhone();
		}else if(deviceRaw.deviceType == Devices.TYPE_IOS_PHONE){
				device = new DeviceIPhone();
		}else if(deviceRaw.deviceType == Devices.TYPE_ANDROID_TABLET){
			device = new DeviceAndroidTablet();
		}else if(deviceRaw.deviceType == Devices.TYPE_IOS_TABLET){
			device = new DeviceIPad();
		}else if(deviceRaw.deviceType == Devices.TYPE_CHROME_BROWSER){
			device = new DeviceChrome();
		}else if(deviceRaw.deviceType == Devices.TYPE_WINDOWS_10){
			device = new DeviceWindows10();
		}else if(deviceRaw.deviceType == Devices.TYPE_FIREFOX){
			device = new DeviceBrowser();
		}else if(deviceRaw.deviceType == Devices.TYPE_IFTTT){
			device = new DeviceIFTTT();
		}else if(deviceRaw.deviceType == Devices.TYPE_IP){
			device = new DeviceIP();
		}else if(deviceRaw.deviceType == Devices.TYPE_MQTT){
			device = null;// new DeviceMqtt();
		}
		if(!device){
			device = new DeviceAndroidPhone();
		}
		if(device){
			for(const prop in deviceRaw){
				device[prop] = deviceRaw[prop];
			}
		}
		return device;
	}
	get isMyDevice(){
		return AppContext.context.isThisDevice(this);
	}
	get isGroup(){
		return this.deviceId.indexOf("group") >= 0;
	}
	get isShared(){
		return this.deviceId.indexOf("share") >= 0;
	}
	canReceiveSms(){
		return false;
	}
	canBeFound(){
		return !this.isShared;
	}
	canOpenApps(){
		return false;
	}
	canBrowseFiles(){
		return false;
	}
	canSendNotifications(){
		return false;
	}
	canBeMediaControlled(){
		return false;
	}
	canWrite(){
		return true;
	}
	canShowPushHistory(){
		return !this.isShared;
	}
	canReceiveNote(){
		return true;
	}
	canSendTab(){
		return true;
	}
	canTakeScreenshot(){
		return false;
	}
	canSyncClipboardTo(){
		return !this.isMyDevice && !this.isShared;
	}
	canTakeScreenCapture(){
		return this.canTakeScreenshot();
	}
	get hasLocalNetworkCapabilities(){
		return false;
	}
	get canReceiveFiles(){
		return !this.isShared;
	}
	getIcon(){
		return null;
	}
	getTaskerCommandText(){
		return null;
	}
	get canContactLocalNetworkKey(){ 
		return `localNetwork${this.deviceId}`;
	}
	get localNetworkServerAddress(){		
		return AppContext.context.localStorage.get(this.canContactLocalNetworkKey);
	}
	get canContactViaLocalNetwork(){ 
		if(this.socket) return true;
		// return false;
		return this.localNetworkServerAddress ? true : false;
	}
	set canContactViaLocalNetwork(value) {
		const key = this.canContactLocalNetworkKey;
		const currentValue = this.canContactViaLocalNetwork;
		if(currentValue != value){
			console.log(`${this.deviceName}: ${value?"local":"remote"}`);
		}
		if(value){
			AppContext.context.localStorage.set(key,value);
			this.tentativeLocalNetworkServerAddress = value;
			EventBus.post(new ConnectViaLocalNetworkSuccess(this));
			this.lastKnownLocalNetworkAddress = value;
		}else{
			AppContext.context.localStorage.delete(key);
		}
	}
	get lastKnownLocalNetworkAddressKey(){ 
		return `lastKnownlocalNetwork${this.deviceId}`;
	}
	set lastKnownLocalNetworkAddress(value){
		AppContext.context.localStorage.set(this.lastKnownLocalNetworkAddressKey,value);
	}
	get lastKnownLocalNetworkAddress(){
		return AppContext.context.localStorage.get(this.lastKnownLocalNetworkAddressKey);
	}
	get lastKnownSocketAddressKey(){ 
		return `lastKnownSocket${this.deviceId}`;
	}
	set lastKnownSocketAddress(value){
		AppContext.context.localStorage.set(this.lastKnownSocketAddressKey,value);
	}
	get lastKnownSocketAddress(){
		return AppContext.context.localStorage.get(this.lastKnownSocketAddressKey);
	}
	async setToRemoteNetwork(requestUpdate){
		this.canContactViaLocalNetwork = false;
		if(!Util.getCurrentUrl().startsWith("http")){
			this.tentativeLocalNetworkServerAddress = null;
		}
		this.socket = null;
		if(!requestUpdate) return;

        await EventBus.post(new RequestUpdateDevice(this));
	}
	get tentativeLocalNetworkServerAddressKey(){ 
		return `localNetworktentative${this.deviceId}`;
	}
	get tentativeLocalNetworkServerAddress(){
		return AppContext.context.localStorage.get(this.tentativeLocalNetworkServerAddressKey);
	}
	set tentativeLocalNetworkServerAddress(value){
		AppContext.context.localStorage.set(this.tentativeLocalNetworkServerAddressKey,value);
	}
	get hasFixableIssue(){
		return !this.canContactViaLocalNetwork && (this.tentativeLocalNetworkServerAddress ? true : false);
	}
	async getViaLocalNetwork({path,token}){
		if(!this.canContactLocalNetworkKey) throw `Can't contact ${this.deviceName} via local network`;

		var url = `${this.localNetworkServerAddress}${path}`
		return await UtilWeb.get({url,token});
	}
	set socket(socket){
		this._socket = socket;
	}
	get socket(){ 
		return this._socket && this._socket.send && this._socket.readyState == this._socket.OPEN ? this._socket : null;
	}
	get api(){
		return (async ()=>{
			return (await import("../api/apiserver.js")).ApiServer;
		})()
		
	}
	async rename(newName){
        return await ((await this.api).renameDevice({"deviceId":this.deviceId, "deviceName":newName}));
	}
	async delete(){
        return await ((await this.api).unregisterDevice({"deviceId":this.deviceId}));
	}
	get allowUnsecureContent(){
		return AppContext.context.allowUnsecureContent;
	}
	get token(){
		return self.getAuthTokenPromise();
	}
	async testLocalNetwork(){
		if(this.socket) return;

		const viaLastKnown = await this.testLocalNetworkLastKnownAndGoogleDrive();
		if(viaLastKnown) return true;

		const gcm = new GCMLocalNetworkTestRequest();
		await this.send(gcm);
		return false;
	}

	async requestLocalNetworkTestAndWaitForResponse(){
		if(this.socket) return true;

		if(!this.hasLocalNetworkCapabilities) throw "Can't contact via local network";

		const resultPromise = EventBus.waitFor(ConnectViaLocalNetworkSuccess, 10000);

		await this.setToRemoteNetwork(true);
		const workedRightAway = await this.testLocalNetwork();
		if(workedRightAway) return new ConnectViaLocalNetworkSuccess(this);

		let response = false;
		try{
			response = await resultPromise;
			response = response.device.canContactViaLocalNetwork
		}catch{
			response = false;
		}
		console.log("Result test local network",response);
		return response;
	}
	async testLocalNetworkLastKnownAndGoogleDrive(){
		if(this.socket) return true;

		const allowUnsecureContent = this.allowUnsecureContent;
		const token = await this.token;
		let serverAddress = this.lastKnownLocalNetworkAddress;
		let webSocketServerAddress = this.lastKnownSocketAddress;
		let addressesFile = null;
		const setAddressesFromGoogleDrive = async () => {
			if(!addressesFile){
				try{
					addressesFile = await new GoogleDrive(()=>token).downloadContent({fileName: "serveraddresses=:=" + this.deviceId});
				}catch{
					addressesFile = {};
				}
			}
			let serverAddressGD = allowUnsecureContent ? addressesFile.serverAddress : addressesFile.secureServerAddress;
			let webSocketServerAddressGD = addressesFile.webSocketServerAddress;
			if(serverAddressGD != serverAddress || webSocketServerAddress != webSocketServerAddressGD){
				serverAddress = serverAddressGD;
				webSocketServerAddress = webSocketServerAddressGD;
				return true;
			}

			return false;
		}
		if(!serverAddress || !webSocketServerAddress) {
			await setAddressesFromGoogleDrive();
		}
		if(!serverAddress || !webSocketServerAddress) return false;

		const testIfAvailable = async () => {
			try{
				return await Util.withTimeout(this.testIfLocalNetworkIsAvailable({serverAddress,webSocketServerAddress,allowUnsecureContent,token}),5000);
			}catch{
				return false;
			}
		}
		let success = await testIfAvailable();
		if(!success){					
			const shouldTestAgain = await setAddressesFromGoogleDrive();
			if(shouldTestAgain){
				success = await testIfAvailable();
			}
		}
		this.canContactViaLocalNetwork = serverAddress;
		return success;
	}

	async testIfLocalNetworkIsAvailable({serverAddress,webSocketServerAddress,allowUnsecureContent,token}){

		console.log(`Testing local network for ${this.deviceName} on ${serverAddress}...`);
		
        const gcmTest = new GCMLocalNetworkTest();
        const sender = new SenderLocal();
        // gcmTest.senderId = app.myDeviceId;
		try{           
            const options = {
                devices: [this],
                gcmRaw: await gcmTest.gcmRaw,
                overrideAddress: serverAddress
            }
            await sender.send(options);
            // const url = `${serverAddress}test`;
            // const token = await app.getAuthToken();
            // await UtilWeb.get({url,token});
            this.canContactViaLocalNetwork = serverAddress;
            this.tentativeLocalNetworkServerAddress = null;
			// const result = await device.send(gcmTest);
			// if(!result || !result.success) {
			// 	device.canContactViaLocalNetwork = false;
			// 	return
            // }
            if(!allowUnsecureContent) return true;      
			if(this.socket) return true;
			
			try{
				const webSocketInfo = await this.getViaLocalNetwork({path:`websocket`,token});
				if(webSocketInfo.payload && webSocketInfo.payload.address){
					webSocketServerAddress = webSocketInfo.payload.address;
				}
			}catch(error){
				console.log("Can't get socket info via http server",error)
			}
            if(!webSocketServerAddress) return true;
			
			try{
				console.log("Allows unsecure connection. Trying websocket!");
				
				this.socket = await this.connectToSocket(webSocketServerAddress);
				console.log("Socket connected!!!",this.deviceName,this.socket);
				const socketDisconnected = () => {	
					//this.setToRemoteNetwork(true);
				}
				this.socket.onmessage = e =>{			
					const gcmRaw = JSON.parse(e.data);
					console.log("Socket message",gcmRaw.type);
					EventBus.post(new WebSocketGCM(gcmRaw));
				}
				this.socket.onclose = e => {
					console.log("Socket closed",e,this);
					socketDisconnected();
				}
				this.socket.onerror = e => {
					console.log("Socket error",e,this);
					socketDisconnected();
				}
				const gcmSocketTest = new GCMWebSocketRequest();
				gcmSocketTest.senderId = AppContext.context.getMyDeviceId();
				await this.send(gcmSocketTest);
				this.lastKnownSocketAddress = webSocketServerAddress;
			}catch{
				//even if socket fails we can still contact via http so ignore
			}
			return true;
			
		}catch(error){
			console.error("Error conneting to local network device",this,error)
            this.tentativeLocalNetworkServerAddress = serverAddress;
			this.canContactViaLocalNetwork = false;
			return false;
		}
	}
	async connectToSocket(webSocketServerAddress){
		const socket = new WebSocket(webSocketServerAddress);
		return new Promise((resolve,reject)=>{
			socket.onopen = async e =>{
				resolve(socket);
			}
			socket.onclose = e => {
				reject(e);
			}
			socket.onerror = e => {
				reject(e);
			}
		});
	}
}

class WebSocketGCM{
    constructor(gcmRaw){
        this.gcmRaw = gcmRaw;
    }
}
class DeviceAndroid extends Device{
	canReceiveSms(){
		return !this.isShared;
	}
	canOpenApps(){
		return !this.isShared;
	}
	canTakeScreenshot(){
		return !this.isShared;
	}
	canSendNotifications(){
		return !this.isShared;
	}
	canBeMediaControlled(){
		return !this.isShared;
	}
	canBrowseFiles(){
		return !this.isShared;
	}
	get hasLocalNetworkCapabilities(){
		return !this.isShared;
	}
}
export class DeviceAndroidPhone extends DeviceAndroid{
	getIcon(){
		return "./images/phone.png";
	}	
}

export class DeviceAndroidTablet extends DeviceAndroid{
	getIcon(){
		return "./images/tablet.png";
	}
}

export class DeviceIPhone extends Device{
	getIcon(){
		return "./images/iphone.png";
	 }
	 
	canSyncClipboardTo(){
		return false;
	}
}
export class DeviceIPad extends Device{
	getIcon(){
		return "./images/ipad.png";
	}
	 
	canSyncClipboardTo(){
		return false;
	}
}
export class DeviceChrome extends Device{
	getIcon(){
		return "./images/chrome.png";
	}
	canBeFound(){
		return false;
	}
	getTaskerCommandText(device){ 
		return "EventGhost Command";
	}
	canShowPushHistory(){
		return !this.isShared;
	}
}

export class DeviceWindows10 extends Device{
	getIcon(){
		return "./images/windows10.png";
	}
	canBeFound(){
		return false;
	}
	getTaskerCommandText(device){ 
		return "EventGhost Command";
	}
	canShowPushHistory(){
		return !this.isShared;
	}
	 
	canSyncClipboardTo(){
		return false;
	}
}

export class DeviceIFTTT extends Device{
	getIcon(){
		return "./images/ifttt.png";
	}
	canBeFound(){
		return false;
	}
	canSendTab(){
		return false;
	}
	canShowPushHistory(){
		return false;
	}
	canReceiveNote(){
		return false;
	}
	canWrite(){
		return false;
	}
	getTaskerCommandText(device){
		return "Maker Event";
	}	
	 
	canSyncClipboardTo(){
		return false;
	}
}
export class DeviceIP extends Device {
	getIcon(){
		return "./images/ip.png";
	}
	canBeFound(){
		return false;
	}
	canSendTab(){
		return false;
	}
	canShowPushHistory(){
		return false;
	}
	canReceiveNote(){
		return false;
	}
	canWrite(){
		return false;
	}
	getTaskerCommandText(device){
		return "Command";
	}
	 
	canSyncClipboardTo(){
		return false;
	}
}

export class DeviceMqtt extends Device{
	getIcon(){
		return "./images/mqtt.png";
	}
	canBeFound(){
		return false;
	}
	canSendTab(){
		return false;
	}
	canShowPushHistory(){
		return false;
	}
	canReceiveNote(){
		return false;
	}
	canWrite(){
		return false;
	}
	getTaskerCommandText(device){
		return "Command";
	}
	 
	canSyncClipboardTo(){
		return false;
	}
}
export class DeviceBrowser extends Device{
	getIcon(){
		return "./images/firefox.png";
	}
	canBeFound(){
		return false;
	}
	 
	canSyncClipboardTo(){
		return false;
	}
	canShowPushHistory(){
		return false;
	}
}

class StatusReport{
	constructor(message){
		this.message = message;
	}
}
class RequestUpdateDevice{
	constructor(device){
		this.device = device;
	}
}
class ConnectViaLocalNetworkSuccess{
	constructor(device){
		this.device = device;
	}
}