import { Devices } from "./device.js";

export class DBDevices{
    constructor(db){
        this.db = db;
    }
    async update(devices){
        await this.db.devices.clear();
        for(const device of devices){
            await this.updateSingle(device)
        }
    }
    async updateSingle(device){
        await this.db.devices.put({deviceId:device.deviceId,json:JSON.stringify(device)});
    }
    async getAll(){
        const array = await this.db.devices.toArray();
        const devices = array.map(item=>JSON.parse(item.json));
        return new Devices(devices);
    }
    async getById(deviceId){
        return await this.db.devices.get(deviceId);
    }
}