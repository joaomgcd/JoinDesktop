import { EventBus } from "./eventbus.js";
import { Control } from "./control.js";

export class AppHelperBase{
    constructor(app){
        this.app = app;
    }
    async unload(){
        await Control.unloadControls(this);
    }
    //abstract
    updateUrl(){}

    async onRequestLoadDevicesFromServer(){
        if(!this.app) return;

        const devices = await this.app.devicesFromDb;
        await devices.testLocalNetworkDevices({allowUnsecureContent:this.app.allowUnsecureContent,token:await this.app.getAuthToken()});
    }
}