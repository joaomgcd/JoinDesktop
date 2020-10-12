import { App } from "../app.js";
import { ControlNotificationClickHandler } from "../gcm/notificationclickhandler/controlnotificationclickhandler.js";
import { EventBus } from "../eventbus.js";
import { AppHelperBase } from "../apphelperbase.js";
import { Device } from "../device/device.js";
import { NotificationInfo } from "./notificationinfo.js";
import { GCMRequestFile,GCMNotificationClear } from "../gcm/gcmapp.js";

/** @type {App} */
let app = null;
export class AppHelperNotifications extends AppHelperBase{

/**
 * 
 * @param {App} _app 
 */
    constructor(args = {app,device}){
        super(args.app);
        app = args.app;
        this.device = args.device;
    }
    async load(){
        EventBus.register(this);

        this.device = await app.myDevice;
        app.controlTop.appName = `Join Notifications`;
        app.controlTop.appNameClickable = true;
        app.controlTop.shouldAlwaysShowImageRefresh = true;
        this.controlNotificationClickHandler = new ControlNotificationClickHandler();
        await app.addElement(this.controlNotificationClickHandler);

        await app.loadFcmClient();
        await this.refreshNotifications(true);
        
    }    
    async onAppNameClicked(appNameClicked){
        await app.showDeviceChoiceOnAppNameClicked(appNameClicked,device=> device.isMyDevice || device.canSendNotifications()/*,device=>device.isMyDevice?"All Devices":device.deviceName*/)
    }
    async onAppDeviceSelected(appDeviceSelected){
        this.device = appDeviceSelected.device;
        await this.refreshNotifications(true);
    }
    async onNotificationInfos(notificationInfos){
        if(!this.device || !this.device.isMyDevice) return;

        await this.refreshNotifications(true);
    }
    async refreshNotifications(onlyStoredIfMine){
        let stillLoading = false;
        try{
            this.notifications = [];
            // const dbGCM = (await this.dbGCM);
            // const notificationsFromDb = await dbGCM.getAll();
            // for(const fromDb of notificationsFromDb){
            //     if(fromDb.done) continue;

            //     await eventBusLocal.post(fromDb);
            //     //await dbGCM.remove(fromDb.gcmId);
            //     // await dbGCM.setDone(fromDb.gcmId);
            // }
            // await dbGCM.clear();
            if(this.device && this.device.isMyDevice){
                try{
                    const ownNotificationsPromise = EventBus.waitFor(StoredNotifications,5000);
                    EventBus.post(new RequestStoredNotifications());
                    const ownNotifications = await ownNotificationsPromise;                    
                    const options = ownNotifications.options;
                    const {NotificationInfo} = await import("./notificationinfo.js");
                    let notifications = options.map(async option => {
                        const notification = new NotificationInfo(option);
                        notification.isMyNotification = true;
                        await notification.getDeviceFromInfo(async deviceId => await app.getDevice(deviceId));
                        return notification;
                    });
                    notifications = await Promise.all(notifications);
                    await this.addNotifications(notifications);
                    if(onlyStoredIfMine){
                        return;
                    }
                }catch(error){
                    console.error("Couldn't get own notifications",error);
                }
            }
            const token = await app.getAuthToken();
            const devices = this.device && !this.device.isMyDevice ? [this.device] : (await app.devicesFromDb).filter(device=>device.canSendNotifications());
            if(devices.length == 0){
                this.notifications = [];
                return;
            }
            app.controlTop.loading = true;
            const allPromises = devices.map(async device=>{
                const notifications = await device.loadNotifications({token})
                if(!notifications){
                    stillLoading = true;
                    return;
                }
                await this.addNotifications(notifications);
            });
            await Promise.all(allPromises);
        }catch(error){
            app.showToast({text:`Couldn't load notifications: ${error}`,isError:true, time:5000})
        }finally{
            if(!stillLoading){
                app.controlTop.loading = false;                    
            }
        }
    }
    // /** @type {DBGCM} */
    // get dbGCM(){
    //     return app.dbGCM;
    // }
    async onRequestRefresh(){
        await this.refreshNotifications();
    }
    async addNotifications(notifications){
        await this.controlNotificationClickHandler.addNotifications(notifications);
    }
    set notifications(value){
        this.controlNotificationClickHandler.notifications = value;
        this.controlNotificationClickHandler.render();
    }
    
    async onDBNotificationsUpdated(){
        if(!this.device || !this.device.isMyDevice) return;

        await this.refreshNotifications();
    }
    async onRequestNotificationAction({notificationButton,notification}){
        // if(!this.device) return;
        // if(this.device.isMyDevice) return;

        // const device = this.device;
        // app.controlTop.loading = true;
        // await app.doNotificationAction({device,notificationButton,notification});
        if(notificationButton.action == GCMNotificationBase.notificationDismissAction.action){
            await this.controlNotificationClickHandler.removeNotification(notification);
        }
        // app.controlTop.loading = false;
    }
    updateUrl(){
        Util.changeUrl(`?notifications`);
    }
    async onFAB(){
        app.controlTop.loading = true;
        const notifications = this.controlNotificationClickHandler.notifications;
        const gcmNotificationClear = new GCMNotificationClear();
        const uniqueDevices = [...new Set(notifications.map(notification=>notification.device))].filter(device=>device!=null);
        const Devices = (await import("../device/device.js")).Devices;
		const devices = new Devices(uniqueDevices);
		gcmNotificationClear.senderId = app.myDeviceId;
        gcmNotificationClear.authToken = this.authToken;
        gcmNotificationClear.requestNotification = {notificationIds:notifications.map(notification => notification.id)}
        devices.send(gcmNotificationClear)
        app.controlTop.loading = false;
    }
    async onGCMNotification(gcm){
        const notifications = gcm.requestNotification.notifications;
		if(!notifications) return;

        const authToken = await app.getAuthToken();
        gcm.authToken = authToken;
        gcm.senderId = gcm.requestNotification.senderId;
        const device = await app.getDevice(gcm.senderId);
        notifications.forEach(async notification=>{
            const notificationInfo = new NotificationInfo(notification,device);
            notificationInfo.gcmId = gcm.gcmId;
            await this.addNotifications(notificationInfo);
        });
    }
    async onGCMNotificationClear(gcm){
        const requestNotification = gcm.requestNotification;
        if(!requestNotification) return;

        const device = await app.getDevice(requestNotification.senderId);
        if(!device) return;

        const id = requestNotification.requestId;
        await this.controlNotificationClickHandler.removeNotificationById({id,device});
    }
    async onGCMRespondFile(gcm){
        const responseFile = gcm.responseFile;
        if(!responseFile) return;

        const request = responseFile.request;
        if(!request) return;

        const requestType = request.requestType;
        if(requestType != GCMRequestFile.TYPE_NOTIFICATIONS) return;

        const fileId = responseFile.fileId;
        if(!fileId) return;

        const device = await app.getDevice(responseFile.senderId);
        if(!device) return;

        let notifications = await app.googleDrive.downloadContent({fileId});
        notifications = await Encryption.decrypt(notifications);
        notifications.device = device;
        
        await this.addNotifications(notifications);
        app.controlTop.loading = false;  
    }
    
    // async onGCMPush(gcm){
    //     var {push,notification} = await AppGCMHandler.handleGCMPush(app,gcm,gcm.done);
    //     if(!notification || !push) return;

    //     if(!gcm.done){
    //         if(push.clipboard){
    //             try{
    //                 await Util.setClipboardText(push.clipboard);
    //                 notification.title = "Clipboard Set"
    //             }catch(error){
    //                 const title = "Couldn't set clipboard. Please copy manually.";
    //                 app.showToast({text:title,isError:true,time:5000});
    //                 notification.title = title;
    //             }
    //         }
    //     }
    //     notification.device = await app.getDevice(notification.senderId);
    //     notification.gcmId = gcm.gcmId;
    //     notification = new NotificationInfo(notification);
    //     this.addNotifications(notification);
    // }
}
class RequestStoredNotifications{}
class StoredNotifications{}