import { AppContext } from "../appcontext.js";
import { EventBus } from "../eventbus.js";
let GCMBaseFinal = null;
try{
	GCMBaseFinal = GCMBase
}catch{
	const {GCMBase} = require("./gcmbase.js")
	GCMBaseFinal = GCMBase
}
GCMBaseFinal.getGCMFromType = type => eval(`new ${type}()`);
class GCMBaseApp extends GCMBaseFinal{
	get myDeviceId(){
		return AppContext.context.getMyDeviceId();
	}
	async execute(){
		const sentToCompanionApp = await this.sendToCompanionAppIfNeeded();
		if(sentToCompanionApp){
			console.log("Sent to companion app. Not performing action here.")
			return;
		}
		this.sendToLocalAutomationPortIfNeeded();
		await EventBus.post(this);
	}
	//open
	async encrypt(){}
	async getDevice(deviceId){
		const {DBDevices} = await import("../device/dbdevice.js");
		const db = new DBDevices(DB.get());
		const device = await db.getById(deviceId);
		return device;
	}
	
	async send(deviceId){
        const gcmRaw = await this.gcmRaw;
		await EventBus.post(new RequestSendGCM(gcmRaw,deviceId))
    }
	async sendPush(push){
		const gcmPush = new GCMPush();
		gcmPush.push = push;
		await gcmPush.send(push.deviceId);
	}
}
class GCMGenericPush extends GCMBaseApp{
	get json(){
		return (async ()=>{
			return await Encryption.encrypt(JSON.stringify(this));
		})();
	}
}
export class GCMLocation extends GCMBaseApp {}
export class GCMPush extends GCMBaseApp{
	static get RESPONSE_TYPE_PUSH(){
		return 0;
	}
	static get RESPONSE_TYPE_FILE(){
		return 1;
	}
	get notificationInfo(){
		const push = this.push;
        if(!push) return;

		if(!push.date){
			push.date = new Date().getTime();
		}
		if(push.date.formatDate){
			push.date = push.date.formatDate({full:true})
		}
        
		var title = push.title;
        var text = push.text;
		const setTitle = toSet => {
			if(title) return;
			title = toSet;
		};
		const setText = toSet => {
			if(text) return;
			text = toSet;
		};
        
        const handleClipboard = async push => {
            const clipboard = push.clipboard;
            if(!clipboard) return;
            
            setTitle(`Setting Clipboard`);
            setText(`Click to copy: ${clipboard}`);
        }
        const handleUrl = async push => {
			if(push.title) return;
			
            const url = push.url;
            if(!url) return;

			setTitle("Opened URL")
			setText(`${url}`);
        }
        const handleFiles = async push => {
            const files = push.files;
            if(!files || files.length == 0) return;
            
			setTitle("Received Files");
			setText("Opening now...");
        }
        const handleLocation = async push => {
            if(!push.location) return;

			setTitle("Location Requested");
			setText("Checking location...");
        }
        const handleSpeak = async push => {
            const say = push.say;
            if(!say) return;

			setTitle("Saying Out Loud");
            setText(say);
        }
        handleUrl(push);
        handleClipboard(push);
        handleFiles(push);
        handleLocation(push);
        handleSpeak(push);

        setTitle("Join");
        setText("Received Push");

		const notification = {
			"appName":"Join",
			"title":title,
			"text":text,
			"requireInteraction":true,
			data:this,
            actions:[]
        };
        if(push.url){
            notification.actions.push(GCMPushBase.notificationActionCopyUrl);
        }
		Object.assign(notification, push);
		return notification;
	}
	async encrypt(){
		const push = this.push;
		const e = Encryption.encrypt
		push.text = await e(push.text);
		push.url = await e(push.url);
		push.smsnumber = await e(push.smsnumber);
		push.smstext = await e(push.smstext);
		push.clipboard = await e(push.clipboard);
		push.file = await e(push.file);
		push.files = await e(push.files);
		push.wallpaper = await e(push.wallpaper);
	}
	async sendTextToLocalPort({port}){
		return await GCMPushBase.sendTextToLocalPort({gcmPush:this,port});
	
	}
	async handleNotificationClick(notificationAction){
		const push = this.push;
		if(!push) return;

		if(!notificationAction){
			if(push.url){
				await Util.openWindow(push.url);
			}
			return;
		}
		if(notificationAction == GCMPushBase.notificationActionCopyUrl.action){
			Util.setClipboardText(push.url);
		}
	}
}
class GCMNotification extends GCMBaseApp{}
export class GCMNotificationClear extends GCMGenericPush{}
class GCMDeviceRegistered extends GCMBaseApp{}
export class GCMLocalNetworkRequest extends GCMBaseApp{}
export class GCMLocalNetworkTest extends GCMGenericPush{}
export class GCMWebSocketRequest extends GCMGenericPush{}
export class GCMLocalNetworkTestRequest extends GCMGenericPush{}
export class GCMNotificationAction extends GCMGenericPush{}
export class GCMRequestFile extends GCMGenericPush{
	static get TYPE_SCREENSHOT (){
		return 1;
	}
	static get TYPE_VIDEO (){
		return 2;
	}
	static get TYPE_SMS_THREADS (){
		return 3;
	}
	static get TYPE_SMS_CONVERSATION (){
		return 4;
	}
	static get TYPE_NOTIFICATIONS (){
		return 5;
	}
	static get TYPE_MEDIA_INFOS (){
		return 7;
	}
}
export class GCMRespondFile extends GCMGenericPush{
	async execute(){
		this.sendToCompanionAppIfNeeded();
		EventBus.post(this);

		const response = this.responseFile;
		if(!response) return;
		
		const request = response.request;
		if(!request) return;

		const type = request.requestType;
		if(!type) return;

		if(type != GCMRequestFile.TYPE_VIDEO) return;
		
		const downloadUrl = response.downloadUrl;
		if(!downloadUrl) return;

		await Util.openWindow(downloadUrl);
		/*const response = this.responseFile;
		if(!response) return;

		const downloadUrl = response.downloadUrl;
		if(!downloadUrl) return;

		await Util.openWindow(downloadUrl);*/
	}
}
export class GCMNewSmsReceived extends GCMGenericPush{}
export class GCMSmsSentResult extends GCMGenericPush{}
export class GCMMediaInfo extends GCMGenericPush{	
	async handleNotificationClick(action){
		return await GCMMediaInfoBase.handleNotificationClick(this,action,Util.openWindow);
	}
}
export class GCMDeviceNotOnLocalNetwork extends GCMGenericPush{}
export class GCMStatus extends GCMGenericPush{}
export class GCMFolderRequest extends GCMGenericPush{}
export class GCMFolder extends GCMGenericPush{}
export class GCMFile extends GCMGenericPush{}
export class GCMAutoClipboard extends GCMGenericPush{}

class RequestSendGCM{
    constructor(gcmRaw,deviceId){
        this.gcmRaw = gcmRaw;
        this.deviceId = deviceId;
    }
}