import { DBGoogleDriveLoader } from "../google/drive/dbgoogledriveloader.js";

class LoaderNotificationInfos extends DBGoogleDriveLoader{
    async loadFromGoogleDrive(args){
        return await PushHistory.fromGoogleDrive(args);
    }
    get alwaysRequestFromGoogleDrive(){
        return true;
    }
    
}
export class PushHistory extends Array{
    constructor(initial,device,getDevice){
        if(Number.isInteger(initial)){
			super(initial);
			return;
        }
        super();
        this.device = device;
        initial.forEach(pushRaw=>{
            const push = new Push(pushRaw,device,getDevice);
            this.push(push);
        });
    }
    
    static get loader(){
        return new LoaderNotificationInfos();
    }
    
    static async fromGoogleDrive({device,token,getDevice}){
        const raw = await new GoogleDrive(()=>token).downloadContent({fileName: "pushes=:=" + device.deviceId});
        if(!raw || !raw.pushes) return new PushHistory([],device);

        const mediaInfos = new PushHistory(raw.pushes,device,getDevice);
        return mediaInfos;
    }
}
export class Push{
    static get typeUrl(){
        return "URL";
    }
    static get typeText(){
        return "Text";
    }
    static get typeNotification(){
        return "Notification";
    }
    static get typeSMS(){
        return "SMS";
    }
    static get typeClipboard(){
        return "Clipboard";
    }
    static get typeRing(){
        return "Ring";
    }
    static get typeLocate(){
        return "Locate";
    }
    constructor(pushRaw,device,getDevice){
        Object.assign(this,pushRaw);
        this.device = device;
        this.getDevice = getDevice;
    }
    get type(){
        if(this.url){
            return Push.typeUrl;
        }
        if(this.text){
            if(this.title){
                return Push.typeNotification;
            }else{                
                return Push.typeText;
            }
        }
        if(this.smstext && this.smsnumber){
            return Push.typeSMS;
        }
        if(this.clipboard){
            return Push.typeClipboard;
        }
        if(this.find){
            return Push.typeRing;
        }
        if(this.location){
            return Push.typeLocate;
        }
    }
    get isTypeUrl(){
        return this.type == Push.typeUrl;
    }
    get isTypeText(){
        return this.type == Push.typeText;
    }
    get isTypeNotification(){
        return this.type == Push.typeNotification;
    }
    get isTypeSMS(){
        return this.type == Push.typeSMS;
    }
    get isTypeClipboard(){
        return this.type == Push.typeClipboard;
    }
    get canBeOpened(){
        return this.isTypeUrl;
    }
    get valueForActions(){
        if(this.isTypeUrl){
            return this.url;
        }
        if(this.isTypeText || this.isTypeNotification){
            return this.text;
        }
        if(this.isTypeSMS){
            return this.smstext;
        }
        if(this.isTypeClipboard){
            return this.clipboard;
        }
    }
    get sender(){
        if(!this.getDevice || !this.senderId) return null;

        return this.getDevice(this.senderId);
    }
}