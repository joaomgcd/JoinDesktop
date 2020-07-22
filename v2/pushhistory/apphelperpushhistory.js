import { EventBus } from "../eventbus.js";
import { AppHelperBase } from "../apphelperbase.js";
import { ControlPushHistory } from "./controlpushhistory.js";

/**@type {App} */
let app = null;
export class AppHelperPushHistory extends AppHelperBase{
 /**
     * 
     * @param {App} app 
     */
    constructor(args = {app}){
        super(args.app);
        app = args.app;
        this.device = args.device;
    }
    
    async load(){
        EventBus.register(this);  
        if(this.deviceId){
            this.device = await app.getDevice(this.deviceId);
        }else{
            this.deviceId = this.device.deviceId;
        }
        app.controlTop.appNameClickable = true;
        app.controlTop.shouldAlwaysShowImageRefresh = true;  

        this.controlPushHistory = new ControlPushHistory();
        await app.addElement(this.controlPushHistory);
        await this.refresh();
    }
    async refresh(device){
        app.controlTop.loading = true;
        try{
            if(device){
                this.device = device;
                this.deviceId = device.deviceId;
                app.pushHistoryDevice = device;
            }
            this.updateUrl();
            app.controlTop.appName = `${this.device.deviceName} Push History`; 
            const pushHistory = await this.device.loadPushHistory({token:await app.getAuthToken(),getDevice:async deviceId=>await app.getDevice(deviceId)})
            await this.controlPushHistory.updatePushHistory(pushHistory);
        }finally{
            app.controlTop.loading = false;
        }
    }
    async onAppNameClicked(appNameClicked){
        await app.showDeviceChoiceOnAppNameClicked(appNameClicked,device => device.canShowPushHistory())
    }
    async onAppDeviceSelected(appDeviceSelected){
        await this.refresh(appDeviceSelected.device);
    }
    async onRequestRefresh(){
        await this.refresh();
    }
    updateUrl(){
        const url = Util.getCurrentUrlWithParameters({pushhistory:this.device.deviceId});
        Util.changeUrl(url);
    }
    get isPanel(){
        return true;
    }
}