import { Contacts } from "../contacts.js";
import { DBSMSThreads } from "../dbsms.js";
import { EventBus } from "../../eventbus.js";
import { DBGoogleDriveLoader } from "../../google/drive/dbgoogledriveloader.js";

class LoaderSMSThreads extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        return new DBSMSThreads(db);
    }
    async loadFromGoogleDrive(args){
        return await SMSThreads.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        return await SMSThreads.fromLocalNetwork(args);
    }
}
export class SMSThreads extends Array{
    constructor(initial,contacts,deviceId){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();

        if(!initial || !initial.map) return;

        this.deviceId = deviceId;
        initial.sortByMultiple(false,thread=>thread.date);
        initial.forEach(thread=>{
            const contact = contacts.get(thread.address);
            this.push(new SMSThread(contact,thread,deviceId));
        });
    }
    static get loader(){
        return new LoaderSMSThreads();
    }
    static async fromGoogleDrive({deviceId,token,contacts}){
        const threadsRaw = await new GoogleDrive(()=>token).downloadContent({fileName: "lastsms=:=" + deviceId});

        const smsThreads = new SMSThreads(threadsRaw,contacts,deviceId);

        return smsThreads;
    }   
    static async fromLocalNetwork({device,deviceId,token,contacts}){
        const threadsRaw = await device.getViaLocalNetwork({path:`sms`,token});
        const smsThreads = new SMSThreads(threadsRaw.payload,contacts,deviceId);
        return smsThreads;
    }
}
export class SMSThread {
    constructor(contact,thread,deviceId){
        this.contact = contact;
        this.deviceId = deviceId;
        Object.assign(this,thread);
        if(thread.number){
            this.address = thread.number;
        }
    }
    get contactName(){
        if(this.contact){
            return this.contact.name;
        }
        return this.address;
    }
    get contactPicture(){
        if(this.contact){
            return this.contact.photo;
        }
        return null;
    }
}