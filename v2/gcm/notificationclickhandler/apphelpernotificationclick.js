import { App } from "../../app.js";
import { AppHelperGCM } from "../apphelpergcm.js";
import { NotificationInfo } from '../../notification/notificationinfo.js';
import { EventBus } from "../../eventbus.js";
import { ControlNotificationClickHandler } from "./controlnotificationclickhandler.js";
/**@type {App} */
let app = null;
export class AppHelperNotificationClick{

/**
 * 
 * @param {App} _app 
 */
    constructor(_app,gcmString){
        app = _app;
        this.gcmString = gcmString;
    }
    async load(){
        EventBus.register(this);
        this.controlNotificationClickHandler = new ControlNotificationClickHandler();
        await app.addElement(this.controlNotificationClickHandler);
        

        if(!this.gcmString.startsWith("{")){
            const fromDb = await (await app.db).gcm.get(parseInt(this.gcmString));
            if(fromDb){
                this.gcmString = fromDb.json;
            }
        }
        const gcmRaw = JSON.parse(this.gcmString);
        this.gcm = await GCMBase.getGCMFromJson(gcmRaw.type,this.gcmString);
        EventBus.post(this.gcm);
        await app.loadFcmClient();
    }
    get deviceSender(){
        return (async()=>{
            return await app.getDevice(this.gcm.senderId);
        })();
    }
    set notification(value){
        this.controlNotificationClickHandler.notification = value;
        this.controlNotificationClickHandler.render();
    }
    
    async onRequestReplyMessage({text,notification}){
        const device = await this.deviceSender;
        await app.replyToMessage({device,text,notification});
        window.close();
    }
    async onRequestNotificationAction({notificationButton,notification}){
        const device = await this.deviceSender;
        await app.doNotificationAction({device,notificationButton,notification});
    }
    async onGCMNotification(gcm){
        const notification = gcm.requestNotification.notifications[0];
        if(!notification) return;

        const device = await app.getDevice(gcm.senderId);
        notification.device = device.deviceName;
        notification.icon = notification.iconData;
        notification.date = notification.date.formatDate({full:true});
        this.notification = notification;
    }
    async onGCMPush(gcm){
        var {push,notification} = await AppHelperGCM.handleGCMPush(app,gcm);
        if(!notification || !push) return;

        if(push.clipboard){
            try{
                await Util.setClipboardText(push.clipboard);
                notification.title = "Clipboard Set"
            }catch(error){
                const title = "Couldn't set clipboard. Please copy manually.";
                app.showToast({text:title,isError:true,time:5000});
                notification.title = title;
            }
        }

        notification = new NotificationInfo(notification);
        this.notification = notification;        
    }
    
    async onGCMNewSmsReceived(gcm){
        const notification = gcm;
        notification.title = `SMS from ${gcm.name}`;
        notification.appName = gcm.name;
        notification.date = notification.date.formatDate({full:true});
        notification.icon = gcm.photo;
        notification.device = gcm.number;
        notification.statusBarIcon = "";
        notification.replyId = `sms=:=${gcm.number}=:=${gcm.senderId}`;
        this.notification = notification;
    }
    
    async onGCMLocation(gcm){ 
        const notification = await AppHelperGCM.handleLocation(gcm);
        if(!notification) return;

        this.notification = notification;   
    }
}