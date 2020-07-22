import { Devices } from '../v2/device/device.js';

const Store = require('./store.js');
const devicesStore = new Store({
    configName: 'devices',
    defaults: []
});

export class DevicesServer{
    /** @type {Devices} */
    static get devices(){
        const raw = devicesStore.getData();
        return new Devices(raw);
    }
    static set devices(value){
        // console.log("Storing devices",value);
        devicesStore.setData(value);
    }
    static async getDevice(deviceId){
        if(!deviceId) return;

        const device = await DevicesServer.devices.getDevice(deviceId);
        // console.log("Found device",device);
        return device;
    }
}