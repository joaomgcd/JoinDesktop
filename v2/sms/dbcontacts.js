import { Contacts } from "./contacts.js";


const getKey = ({deviceId,number}) => deviceId+":"+number;
export class DBContacts{
    constructor(db){
        this.db = db;
    }
    async updateAll(deviceId,contacts){
        await this.db.contacts.clear();
        for(const contact of contacts){
            const number = contact.number;
            const key = getKey({deviceId,number});
            const json = JSON.stringify(contact);
            await this.db.contacts.put({key,number,deviceId,json});
        }
    }
    async getAll({deviceId}){
        const collection = await this.db.contacts.filter(item=>item.key.startsWith(deviceId));
        const array = await collection.toArray();
        const fromJson = array.map(item=>JSON.parse(item.json));
        const contacts = new Contacts(fromJson);
        return contacts;
    }
}