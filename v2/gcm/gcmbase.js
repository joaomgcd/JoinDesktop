class GCMBase{
	static async executeGcmFromJson(type,json){		
		return await GCMBase.doForGCMFromJson(type,json,async gcm=>await gcm.execute(type));
	}
	static async handleClickGcmFromJson(serviceWorker,type,json,action,data){		
		const gcm = await GCMBase.getGCMFromJson(type,json);
		return await gcm.handleNotificationClick(serviceWorker,action,data);
	}
	static async doForGCMFromJson(type,json,action){
		var gcm = await GCMBase.getGCMFromJson(type,json);
		return {
			"gcm":gcm,
			"notifications" : await action(gcm)
		}
	}
	static async getGCMFromJson(type,json){
        var gcm = null;
        try{
            gcm = GCMBase.getGCMFromType(type)
        }catch(error){
            console.log(`Unkown GCM type: ${type}`)
        }
		if(!gcm){
			gcm = new GCMBase();
		}
		await gcm.fromJsonString(json);
		return gcm;
    }
    //abstract
	static getGCMFromType(type){}
	constructor(){
		this.type = this.constructor.name;
	}
	get gcmRaw(){
		if(this._gcmRaw) return this._gcmRaw;

		if(!this.senderId){
			this.senderId = this.myDeviceId;
		}		
		return (async()=>{
			return {
				"json": await this.json,
				"type": this.type
			}
		})();	
	}
	get json(){
		return JSON.stringify(this);
	}
    //abstract
	get myDeviceId(){}
	//abstract
	execute(){}
	set gcmRaw(value){
		this._gcmRaw = value;
	}
	async storeGcmRaw(){
		this.gcmRaw = await this.gcmRaw;
	}
	getResult(title,text,silent){
		return {
			"title":title,
			"text":text,
			"silent":silent
		}
	}
	async handleNotificationClick(action){
		console.log("GCMBase doing nothing on click",action)
	}
	getValueToCheckIfWasEncrypted(props){
		return null;
	}
	async fromJson(json) {
		let valueToCheckIfWasEncrypted = this.getValueToCheckIfWasEncrypted(json);
		for (const prop in json) {
			let value = json[prop];
			try{
				value = await Encryption.decrypt(value);
			}catch{}
			try{
				this[prop] = value;
			}catch{}
		}
		if(valueToCheckIfWasEncrypted && valueToCheckIfWasEncrypted != this.getValueToCheckIfWasEncrypted()){
			this.wasEncrypted = true;
		}
	}
	async fromJsonString(str) {
		try{
			str = await Encryption.decrypt(str);
		}catch{}
		var json = JSON.parse(str);
		await this.fromJson(json);
		//this.json = str;
	}
	async getImageUrl(image){
		return `data:image/png;base64,${image}`; 
	}
	async getSettingValue(settingId){
		const db = new Dexie("join_settings");
		db.version(1).stores({
			settings: 'id,value'
		});

		const setting = await db.settings.get(settingId);
		if(!setting) return null;

		return setting.value;
	}
	async sendToCompanionAppIfNeeded(){		
		try{			
			const companionAppPort = await this.getSettingValue("SettingCompanionAppPortToConnect");
			if(!companionAppPort) return false;
			
			await this.sendToLocalPort({port:companionAppPort});
			return true;
		}catch(error){
			console.log("Couldn't send to companion app",error)
			return false;
		}
	}
	async sendToLocalAutomationPortIfNeeded(){		
		try{
			const hasClients = await Util.serviceWorkerHasClients;
			if(hasClients) return;
			
			const localAutomationPort = await this.getSettingValue("SettingEventGhostNodeRedPort");
			if(!localAutomationPort) return;
			
			const localAutomationFullPush = await this.getSettingValue("SettingAutomationPortFullPush");
			if(localAutomationFullPush){
				return await this.sendToLocalPort({port:localAutomationPort});
			}
			if(!this.push) return;
			return await GCMPushBase.sendTextToLocalPort({gcmPush:this,port:localAutomationPort});
		}catch(error){
			console.log("Couldn't send to automation app",error)
		}
	}
	async sendToLocalPort({port,endpoint}){
		if(!endpoint){
			endpoint = "push";
		}
		const server = "localhost";
		const gcmString = JSON.stringify(await this.gcmRaw);
		const options = {
			method: 'POST',
			body: gcmString,
			headers: {
				'Content-Type': 'application/json'
			},
			mode:"no-cors"
		}
		await fetch(`http://${server}:${port}/${endpoint}`,options)
		
	}
	async getSender(){
		const senderId = this.senderId;
		if(!senderId) return null;

		return await this.getDevice(senderId);
	}
}
class GCMNotificationBase{
	static get notificationDismissAction(){
		return {action: "dismiss",title: 'Dismiss Everywhere'}
	}
	static get notificationReplyAction(){
		return {action: "reply",title: 'Reply Directly'}
	}
	static async getNotificationOptions(notificationfromGcm,Util,GoogleDrive){
		const icon = Util.getBase64ImageUrl(notificationfromGcm.iconData);
		var badge = notificationfromGcm.statusBarIcon;
		badge =  badge ? Util.getBase64ImageUrl(badge) : icon;
		const image = await GoogleDrive.convertFilesToGoogleDriveIfNeeded({files:notificationfromGcm.image,authToken:this.authToken,downloadToBase64IfNeeded:true});
		const options = {
			"id": notificationfromGcm.id,
			"tag": notificationfromGcm.id,
			"title": notificationfromGcm.title,
			"text": notificationfromGcm.text,
			"body": notificationfromGcm.text,
			"icon": icon,
			"badge": badge,
			"image": image,
			"requireInteraction":true,
			"data": {notificationForClick:notificationfromGcm},
			actions: [
				GCMNotificationBase.notificationDismissAction
			]      
		};
		if(notificationfromGcm.buttons){
			notificationfromGcm.buttons.forEach(button=>{
				options.actions.push({action:button.actionId,title:button.text});
			});
		}
		if(notificationfromGcm.replyId){
			options.actions.push(GCMNotificationBase.notificationReplyAction);
		}
		return options;
	}
	static async getGCMReply({senderId,text,notification}){
		const gcmNotificationAction = GCMBase.getGCMFromType("GCMNotificationAction")
		gcmNotificationAction.requestNotification = {
			deviceId:senderId,
			actionId:notification.replyId,
			appPackage:notification.appPackage,
			text
		};
		return gcmNotificationAction;
	}
	static async getNotificationActionGcm({action,notification,deviceId}){
		if(!action){
			const gcmNotificationAction = GCMBase.getGCMFromType("GCMNotificationAction");
			gcmNotificationAction.authToken = this.authToken;
			gcmNotificationAction.requestNotification = {
				deviceId,
				actionId:notification.actionId,
				appPackage:notification.appPackage
			};
			return gcmNotificationAction;
		}
		if(action == GCMNotificationBase.notificationDismissAction.action){
			const gcmNotificationClear = GCMBase.getGCMFromType("GCMNotificationClear");
			gcmNotificationClear.deviceId = deviceId;
			gcmNotificationClear.authToken = this.authToken;
			gcmNotificationClear.requestNotification = {
				deviceIds:[deviceId],
				requestId:notification.id,
			};
			return gcmNotificationClear;
		}
		const gcmNotificationAction = GCMBase.getGCMFromType("GCMNotificationAction");
        gcmNotificationAction.requestNotification = {
            deviceId,
            actionId:action,
            appPackage:notification.appPackage
		};
		return gcmNotificationAction;
	}
}
class GCMNewSmsReceivedBase{
	static async modifyNotification(notification,gcm,contact){
		const title = contact ? `New SMS from ${contact.name}` : "New SMS";
		const options = {
			"tag": gcm.number,
			title,
			"body": gcm.text,
			"icon": gcm.photo,
			"requireInteraction":true,
			"data": await gcm.gcmRaw
		};
		Object.assign(notification,options);
	}
}
class GCMPushBase{	
	static async sendTextToLocalPort({gcmPush, port}){
		const server = "localhost";		

		const options = {
			mode:"no-cors"
		}
		await fetch(`http://${server}:${port}/?message=${encodeURIComponent(gcmPush.push.text)}`,options)
	
	}
	static get notificationActionCopyUrl(){
		return {action: "copyurl",title: 'Copy URL'}
	}
}

class GCMMediaInfoBase{
    
	static get notificationActionBack(){
		return {action: "back",title: '⏪'}
	}
	static get notificationActionPlay(){
		return {action: "play",title: '▶️'}
	}
	static get notificationActionPause(){
		return {action: "pause",title: '⏸️'}
	}
	static get notificationActionSkip(){
		return {action: "skip",title: '⏩'}
	}
	static async modifyNotification(gcm,notification,Util){
		// console.log("Modifying media notification")
		const device = await gcm.getSender();
		notification.id = gcm.packageName + gcm.senderId;
		notification.title = `Media ${gcm.playing ? "playing" : "stopped"}${device ? " on " + device.deviceName : ""}`
		notification.body = `${gcm.track} by ${gcm.artist}`
		if(gcm.art){
			notification.icon =  gcm.art.startsWith("http") ? `${gcm.art}?token=${gcm.authToken}` : Util.getBase64ImageUrl(gcm.art);
		}
		notification.badge = Util.getBase64SvgUrl(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17S7.79 21 10 21 14 19.21 14 17V7H18V3H12Z" /></svg>`);
		notification.actions = [
			// GCMMediaInfo.notificationActionBack,
			gcm.playing ? GCMMediaInfoBase.notificationActionPause : GCMMediaInfoBase.notificationActionPlay,
			GCMMediaInfoBase.notificationActionSkip
		]
		notification.timeout = 10000;
		notification.discardAfterTimeout = true;
		// console.log("Modified media notification",notification)
	}
	static async handleNotificationClick(gcm,action,openWindow){
		const push = await this.getNotificationClickPush(gcm,action,openWindow);
		await gcm.sendPush(push);
	}
	static async getNotificationClickPush(gcm,action,openWindow){
		if(!action){
			openWindow("?media");
			return;
		}
		const push = {deviceId:gcm.senderId};
		if(action == GCMMediaInfoBase.notificationActionPlay.action){
			push.play = true;
		}else if(action == GCMMediaInfoBase.notificationActionPause.action){
			push.pause = true;
		}else if(action == GCMMediaInfoBase.notificationActionSkip.action){
			push.next = true;
		}else if(action == GCMMediaInfoBase.notificationActionBack.action){
			push.back = true;
		}
		push.mediaAppPackage = gcm.packageName;
		return push;
	}
}
try{
	exports.GCMBase = GCMBase;
	exports.GCMMediaInfoBase = GCMMediaInfoBase;
	exports.GCMNotificationBase = GCMNotificationBase;
}catch{}