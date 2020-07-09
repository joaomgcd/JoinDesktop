import { SMSThreads,SMSThread } from "./thread/smsthread.js";
import { SMSConversation } from "./conversation/smsconversation.js";

const getKeyThreads = ({deviceId,address}) => deviceId+":"+address;
const getKeyConversation = ({deviceId,address}) => deviceId+":"+address;
export class DBSMSThreads{
    
    constructor(db){
        this.db = db;
    }
    async updateAll(deviceId,smsThreads){
        await this.db.smsThreads.clear();
        for(const smsThread of smsThreads){
            const address = smsThread.address;
            const key = getKeyThreads({deviceId,address});
            const json = JSON.stringify(smsThread);
            await this.db.smsThreads.put({key,address,deviceId,json});
        }
    }
    async updateSingle(smsThread){
        const address = smsThread.address;
        const deviceId = smsThread.deviceId;
        const key = getKeyThreads({deviceId,address});
        await this.db.smsThreads.delete(key);
        const json = JSON.stringify(smsThread);

        await this.db.smsThreads.put({key,address,deviceId,json});
    }
    async getAll({deviceId,contacts}){
        const all = await this.db.smsThreads.toArray();
        const collection = await this.db.smsThreads.filter(item=>item.key.startsWith(deviceId));
        const array = await collection.toArray();
        const fromJson = array.map(item=>JSON.parse(item.json));
        const smsThreads = new SMSThreads(fromJson,contacts,deviceId);
        return smsThreads;
    }
}

export class DBSMSConversations{    
    constructor(db){
        this.db = db;
    }
    /**
     * 
     * @param {String} deviceId 
     * @param {SMSConversation} smsConversation 
     */
    async updateAll(deviceId,smsConversation){
        const address = smsConversation.address;
        const key = getKeyConversation({deviceId,address});
        await this.db.smsConversations.delete(key);
        const json = JSON.stringify(smsConversation);
        await this.db.smsConversations.put({key,address,deviceId,json});        
    }
    async getAll({deviceId,contact}){
        const address = contact.address;
        const key = getKeyConversation({deviceId,address});    
        const item = await this.db.smsConversations.get(key);   
        if(!item) return null;

        const fromJson = JSON.parse(item.json);
        const smsThreads = new SMSConversation(fromJson,deviceId,contact);
        return smsThreads;
    }
}