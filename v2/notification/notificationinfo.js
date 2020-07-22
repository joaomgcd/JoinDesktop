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
		
		if(args.data && args.data.notificationForClick){
			Object.assign(this, args.data.notificationForClick);
		}
		this.device = device;
		if(!args.text){
			args.text = args.body;
		}
		delete args.body;
		if(args.icon){
			args.iconData = args.icon;
		}else{
			args.iconData = null;
		}
		if(!args.buttons || args.buttons.length == 0){
			if(args.originalActions && args.originalActions.length > 0){
				args.buttons = args.originalActions.map(action=>{return {action:action.action,text:action.text||action.title}});
			}else if(args.actions && args.actions.length > 0){
				args.buttons = args.actions.map(action=>{
					let text = action;
					if(text.text){
						text = text.text;
					}
					let actionFinal = action;
					if(actionFinal.action){
						actionFinal = actionFinal.action;
					}
					if(!Util.isString(text) && action.title){
						text = action.title;
					}
					return {action:actionFinal,text}
				});
			}
		}
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
	async getDeviceFromInfo(deviceGetterById){
		let device = this.device;
		if(device){
			device = await deviceGetterById(device.deviceId);
		}
		if(!device && this.senderId){
			device = await deviceGetterById(this.senderId);
		}
		if(!device){
			const gcm = await this.gcmFromInfo;
			if(gcm){
				device = await deviceGetterById(gcm.senderId);
			}
		}
		if(device){
			this.device = device;
		}
		return device;
	}
	get gcmFromInfo(){
		return (async () => {
			if(!this.data || !this.data.type) return null;
			
			let json = this.data;
			if(this.data.json){
				json = this.data.json;
			}
			if(!Util.isString(json)){
				json = JSON.stringify(json);
			}
			const gcm = await GCMBase.getGCMFromJson(this.data.type,json);
			return gcm;
		})();
	}
}