import { DBGoogleDriveLoader } from "../google/drive/dbgoogledriveloader.js";
import { DBContacts } from "./dbcontacts.js";
import { EventBus } from "../eventbus.js";

class LoaderContacts extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        return new DBContacts(db);
    }
    async loadFromGoogleDrive(args){
        return await Contacts.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        return await Contacts.fromLocalNetwork(args);
    }
}
export class Contacts extends Array{
    constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!initial || !initial.map) return;

        initial.forEach(contact=>this.push(new Contact(contact)));
    }
    static get loader(){
        return new LoaderContacts();
    }
    static async fromGoogleDrive({deviceId,token}){
        const contactsRaw = await new GoogleDrive(()=>token).downloadContent({fileName: "contacts=:=" + deviceId});
        contactsRaw.contacts.sortByMultiple(true,contact=>contact.name);
        
        const contacts = new Contacts(contactsRaw.contacts);
        return contacts;
    }
    static async fromLocalNetwork({device,token}){
        const contactsRaw = await device.getViaLocalNetwork({path:`contacts`,token});
        const contacts = new Contacts(contactsRaw.payload);
        return contacts;
    }
    get(address){
        var contact = this.find(contact=>contact.matchesAddress(address));
        if(!contact){
            contact = new Contact({name:address,address:address});
        }
        return contact;
    }
}
export class Contact {
    constructor(contact){
        Object.assign(this, contact);
    }
    matchesAddress(address){
        return this.number == address;
    }
    get address(){
        return this.number;
    }
    set address(value){
        this.number = value;
    }
}