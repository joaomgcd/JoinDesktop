import { DBGoogleDriveLoader } from "../google/drive/dbgoogledriveloader.js";

class LoaderNotificationInfos extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        return null;
    }
    async loadFromGoogleDrive(args){
        return await NotificationInfos.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        return await NotificationInfos.fromLocalNetwork(args);
    }    
    async requestFromGoogleDrive({device}){
        device.sendNotificationsRequest();
    }
    get requestNewestVersionInsteadOfLoadingFromGoogleDrive(){
        return true;
    }
}
export class NotificationInfos extends Array{	
	constructor(initial,device){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
		this.device = device;
        if(!initial || !initial.map) return;

		initial.forEach(notification=>this.push(new NotificationInfo(notification,device)));
    }
    static async fromLocalNetwork({device,token}){
        const notificationsRaw = await device.getViaLocalNetwork({path:`notifications`,token});
        const notifications = new NotificationInfos(notificationsRaw.payload,device);
        return notifications;
	}
	static get loader(){
		return new LoaderNotificationInfos();
	}
	get device(){
		return this._device;
	}
	set device(value){
		this._device = value;
	}
}
export class NotificationInfo{
	constructor(args,device){
		if(!args) return;
		
		this.device = device;
		Object.assign(this, args);
	}
	callCallback(event, callback){
    	event.preventDefault();
    	if(!callback) return;
    	callback(event.currentTarget.notificationJoin);
	}
	notify(){
		const options = {
		  body: this.text,
		  tag:this.id
		};
		Object.assign(options, this);
        this.notification = new Notification(this.title,options);
		this.notification.notificationJoin = this;
        this.notification.onclose = event => this.callCallback(event,options.onclose);
        this.notification.onclick = event => this.callCallback(event,options.onclick);
        this.notification.onerror = event => this.callCallback(event,options.onerror);
        this.notification.onshow = event => this.callCallback(event,options.onshow);
	}
	get device(){
		return this._device;
	}
	set device(value){
		this._device = value;
	}
}