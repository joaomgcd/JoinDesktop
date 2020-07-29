import { App } from "../app.js";
import { NotificationInfo } from '../notification/notificationinfo.js';
import { EventBus } from "../eventbus.js";
import { GCMLocalNetworkTest, GCMLocation, GCMNotificationAction, GCMPush } from './gcmapp.js';
import { UtilDOM } from '../utildom.js';

/** @type {App} */
let app = null;
export class AppGCMHandler{

/**
 * 
 * @param {App} _app 
 */
    constructor(_app){
        app = _app;
        this.app = app;
        EventBus.register(this);  
    }
    async onGCMNotification(gcm){
        const notifications = gcm.requestNotification.notifications;
		if(!notifications) return;

        const authToken = await app.getAuthToken();
        gcm.authToken = authToken;
        gcm.senderId = gcm.requestNotification.senderId;
        notifications.forEach(async notification=>{
            gcm.notificationId = notification.id;
            const options = await GCMNotificationBase.getNotificationOptions(notification,Util,GoogleDrive);
            Object.assign(options.data,await gcm.gcmRaw);
            options.data.notificationForClick = notification;
            const notificationJoin = new NotificationInfo(options);
            notificationJoin.original = notification;
            await app.showNotification(options,gcm);
            //notificationJoin.notify();
        });
    }
    async onGCMMediaInfo(gcm){
        const device = await app.getDevice(gcm.senderId);
        if(!device) return;

        const {MediaInfo} = await import("../media/mediainfo.js");
        const mediaInfo = new MediaInfo(gcm,device);
        // await mediaInfo.convertArtToBase64(await app.getAuthToken());

        const notification = {};
        await GCMMediaInfoBase.modifyNotification(gcm,notification,Util);
        await app.showNotification(notification,gcm);
        
        const {DBMediaInfos} = await import("../media/dbmediainfo.js");
        const dbMedia = new DBMediaInfos(app.db);
        await dbMedia.updateSingle({device,mediaInfo});
    }
    /**
     * 
     * @param {GCMPush} gcmPush 
     * @param {*} notification 
     */
    static async handleGCMPush(app,gcmPush,justNotification){
        var notification = gcmPush.notificationInfo;
        if(!notification) return {};
        
        const push = gcmPush.push;
        if(justNotification){
            return {push,notification};
        }
        await AppGCMHandler.handlePushUrl(push,gcmPush);
        await AppGCMHandler.handlePushClipboard(push);
        await AppGCMHandler.handlePushFiles(push);
        await AppGCMHandler.handlePushLocation(push);
        await AppGCMHandler.handlePushSpeak(push);
        const device = await app.getDevice(gcmPush.push.senderId) || "Unknown Device";
        notification.device = device;
        notification.gcmId = gcmPush.gcmId;
        if(!Util.isInServiceWorker && !push.title){
            const {SettingEventGhostNodeRedPort} = await import("../settings/setting.js");
            const settingEventGhostNodeRedPort = new SettingEventGhostNodeRedPort();
            const isSendingToApp = await settingEventGhostNodeRedPort.value;
            if(isSendingToApp){
                notification = null;
            }
        }
        return {push,notification};
    }
    static async handlePushClipboard(push){
        const clipboard = push.clipboard;
        if(!clipboard) return;
        
    }
    static async handlePushUrl(push,gcm){
        const url = push.url;
        if(!url) return;

        const opened = await Util.openWindow(url);
        if(!opened) return;

        gcm.done = true;
    }
    static async handlePushFiles(push){        
        var files = push.files;
        if(!files || files.length == 0) return;
            
        files = await GoogleDrive.convertFilesToGoogleDriveIfNeeded({files});
        const promises = files.map(async file=>await Util.openWindow(file));
        return await Promise.all(promises);
    }
    static async handlePushLocation(push){        
        if(!push.location) return;
            
        const deviceSender = await app.getDevice(push.senderId);
        if(!deviceSender) return;

        const location = await Util.getLocation();
        console.log("Got location!", location);
        var gcmLocation = new GCMLocation();
        gcmLocation.latitude = location.coords.latitude;
        gcmLocation.longitude = location.coords.longitude;
        if(push.fromTasker){
            gcmLocation.forTasker = true;
        }
        gcmLocation.requestId = push.requestId;
        deviceSender.send(gcmLocation);
    }
    static async handlePushSpeak(push){
        const say = push.say;
        if(!say) return;

        const utterance = new SpeechSynthesisUtterance(say);              
        console.log(`Saying out loud`,say);
        await UtilDOM.focusWindow();
        await window.speechSynthesis.speak(utterance);
    }
    async onGCMPush(gcm){
        var {push,notification} = await AppGCMHandler.handleGCMPush(app,gcm);
        if(!notification || !push) return;

        const shouldNotify = await this.handleGCMPush({gcm,push,notification});
        if(!shouldNotify) return;
        
        notification = new NotificationInfo(notification);
        
        await app.showNotification(notification,gcm);     

        // (await app.dbGCM).addGcm(gcm);
           
    }
    /**
     * 
     * @returns {Boolean} true if notification should be created, false otherwise 
     */
    async handleGCMPush({gcm, push, notification}){
        if(push.clipboard){
            notification.text = `Click to set to "${push.clipboard}"`;
        }
        return true;
    }
    
    async onGCMNotificationClear(gcm){
        console.log("Notification action", gcm);
    }
    onGCMDeviceRegistered(){
        EventBus.postSticky(new RequestLoadDevicesFromServer());
    }
    
    async onGCMDeviceNotOnLocalNetwork(gcm){
        const device = await app.getDevice(gcm.senderId);
        if(!device) return;

        await device.setToRemoteNetwork(true);
    }
    async onGCMNewSmsReceived(gcm){                
        const options = {};
        GCMNewSmsReceivedBase.modifyNotification(options,gcm);        
        await app.showNotification(options,gcm);
    }
    static async handleLocation(gcm){
        if(!gcm.latitude || !gcm.longitude) return false;
                
		var location = `${gcm.latitude},${gcm.longitude}`;
        await Util.openWindow(`https://www.google.com/maps?q=${location}&ll=${location}&z=17`);
        return {title:"Location Received",text:"Opened in new tab"};
    }
    async onGCMLocation(gcm){ 
        const notification = await AppGCMHandler.handleLocation(gcm);
        if(!notification) return;

        await app.showNotification(notification,gcm);        
    }
    
}
class RequestLoadDevicesFromServer{}
