import { Control } from "../../control.js"
import { ControlNotification } from "../../notification/controlnotification.js";
import { NotificationInfo, NotificationInfos } from "../../notification/notificationinfo.js";
import { UtilDOM } from "../../utildom.js";
import { ControlFAB } from "../../fab/controlfab.js";
import { FAB } from "../../fab/fab.js";
import { EventBus } from "../../eventbus.js";

export class ControlNotificationClickHandler extends Control{
    constructor(){
        super();
        this.controlsNotifications = [];
        EventBus.register(this);
    }
    getHtmlFile(){
        return "./v2/gcm/notificationclickhandler/notificationclickhandler.html";
    }
    getStyleFile(){
        return "./v2/gcm/notificationclickhandler/notificationclickhandler.css";
    }
    
    async onFAB(){
        this.notifications = [];
        await this.render()
        EventBus.post(new NotificationsCleared());
    }
    async renderSpecific({root}){        
        this.contentElement = root;
        this.notificationsElement = await this.$("#notifications");
        this.noNotificationsElement = await this.$("#nonotifications");

        if(!this.controlsNotifications) return;

        if(!this.fabElement){
            const controlFab = new ControlFAB(
                new FAB({icon:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"/></svg>`})
            );
            this.fabElement = await controlFab.render();
            this.contentElement.appendChild(this.fabElement);
        }
        
        this.notificationsElement.innerHTML = "";
        const hasElements = this.controlsNotifications.length > 0;
        UtilDOM.showOrHide(this.notificationsElement,hasElements);
        UtilDOM.showOrHide(this.noNotificationsElement,!hasElements);
        UtilDOM.showOrHide(this.fabElement,hasElements && !this.hideFAB);
        const backgroundColor = this.backgroundColor;
        if(backgroundColor){
            this.contentElement.style["background-color"] = backgroundColor;
            this.notificationsElement.style["background-color"] = backgroundColor;
        }
        for(const controlNotification of this.controlsNotifications){
            const notificationRender = await controlNotification.render();
            this.notificationsElement.appendChild(notificationRender);
        }
    }
    get hideFAB(){
        return this._hideFAB;
    }
    set hideFAB(value){
        this._hideFAB = value;
    }
    get notificationsListSize(){
        let firstNotificationWidth = 0;
        if(this.notificationsElement.length > 0){
            firstNotificationWidth = this.notificationsElement.firstElementChild.clientWidth;
        }
        if(firstNotificationWidth == 0){
            firstNotificationWidth = 500;
        }
        return {width:firstNotificationWidth,height:this.notificationsElement.clientHeight+10};
    }
    get backgroundColor(){
        return this._backgroundColor;
    }
    set backgroundColor(value){
        this._backgroundColor = value;
    }
    set notifications(values){
        const notifications  = values || [];
        this.controlsNotifications = notifications.map(notification=>{
            const controlNotification = new ControlNotification(notification);
            return controlNotification;
        });
    }
    set notification(value){
        this.notifications = [value];
    }
    get notifications(){
        if(!this.controlsNotifications) return [];

        return this.controlsNotifications.map(controlNotification=>controlNotification.notification);

    }

    async removeNotificationByCriteria(criteriaFunc){
        const index = this.controlsNotifications.findIndex(criteriaFunc);
        if(index < 0) return;

        const controlNotification = this.controlsNotifications[index];
        this.controlsNotifications.splice(index,1);
        if(controlNotification){
            await controlNotification.dispose(true);
        }else{
            await this.render();
        }
    }
    /**
     * 
     * @param {NotificationInfo} notification
     */
    async removeNotification(notification){
        await this.removeNotificationByCriteria(controlNotification => controlNotification.notification.id == notification.id);
    }
    async removeNotificationById({id,device}){
        const criteriaFunc = controlNotification => controlNotification.notification.id == id && controlNotification.notification.device.deviceId == device.deviceId;
        const controlNotification = this.controlsNotifications.find(criteriaFunc);
        if(!controlNotification) return;

        const notification = controlNotification.notification;
        // if(notification.replyId) return;

        await this.removeNotificationByCriteria(criteriaFunc);
    }
    async addNotifications(notifications){
        const device = notifications.device;
        if(!Util.isType(notifications, "NotificationInfos")){
            if(!Util.isArray(notifications)){
                notifications = [notifications];
            }
            notifications = new NotificationInfos(notifications,device);
        }
        for(const notification of notifications){
            await this.removeNotification(notification);
            const controlNotification = new ControlNotification(notification);
    
            this.controlsNotifications.splice(0,0,controlNotification);
        }
        this.controlsNotifications.sortByMultiple(false,controlNotification=>controlNotification.notification.isMyNotification,controlNotification=>controlNotification.notification.gcmId)
        return await this.render();
    }

}
class NotificationsCleared{}