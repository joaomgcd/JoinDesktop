import { DBGoogleDriveLoader } from "../../google/drive/dbgoogledriveloader.js";
import { DBSMSConversations } from "../dbsms.js";

class LoaderSMSConversation extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        return new DBSMSConversations(db);
    }
    async loadFromGoogleDrive(args){
        return await SMSConversation.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        return await SMSConversation.fromLocalNetwork(args);
    }
}

export class SMSConversation extends Array{
    constructor(initial,deviceId,contact){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!initial.map){
            Object.assign(this,initial);
        }
        delete this.smses;
        this.contact = contact;
        this.number = contact.address;
        this.deviceId = deviceId;
        if(initial.smses){
            initial = initial.smses;
        }
        initial.sortByMultiple(true,smsMessage=>smsMessage.date);
        initial.forEach(smsMessage=>this.addSmsMessage(smsMessage));
    }
    addSmsMessage(smsMessage){
        smsMessage.contact = this.contact;
        if(!Util.isType(smsMessage,"SMSMessage")){
            smsMessage = new SMSMessage(smsMessage);
        }
        this.push(smsMessage);
    }
    static get loader(){
        return new LoaderSMSConversation();
    }
    static async fromGoogleDrive({deviceId,contact,token}){
        const address = contact.address;
        const conversationRaw = await new GoogleDrive(()=>token).downloadContent({fileName: `sms=:=${deviceId}=:=${address}`});

        const smsConversation = new SMSConversation(conversationRaw,deviceId,contact);

        return smsConversation;
    }
    static async fromLocalNetwork({device,contact,token}){
        const address = contact.address;
        const conversationRaw = await device.getViaLocalNetwork({path:`sms?address=${encodeURIComponent(address)}`,token});
        const smsConversation = new SMSConversation(conversationRaw.payload,device.deviceId,contact);
        return smsConversation;
    }
    get address(){
        return this.number;
    }
}

export class SMSMessage{
    constructor(smsMessage){
        Object.assign(this,smsMessage);
        if(!this.date){
            this.date = new Date().getTime();
        }
    }
    set isLoading(value){
        this._loading = value;
    }
    get isLoading(){
        return this._loading;
    }
}

