const {GCMBase,GCMMediaInfoBase} = require("../v2/gcm/gcmbase.js");
const {Util} = require("../v2/util.js")
import {EventBus} from "../v2/eventbus.js"
import { Devices } from "../v2/device/device.js";
import { DevicesServer } from "./serverdevices.js";
GCMBase.getGCMFromType = type => eval(`new ${type}()`);
const {clipboard,shell} = require('electron')
class RequestSendPush{
    constructor(push){
        this.push = push;
    }
}
export class GCMServer extends GCMBase{
    static async getGCMFromJson(type,json){
        return await GCMBase.getGCMFromJson(type,json);
    }
    async getLog(){
        return JSON.stringify(this);
    }
	async sendPush(push){
		await EventBus.post(new RequestSendPush(push))
	}
	async getDevice(deviceId){
		return await DevicesServer.getDevice(deviceId)
	}
}
class CompanionHostConnected{
    constructor({companionBrowserId}){
        this.companionBrowserId = companionBrowserId;
    }
}
class GCMPush extends GCMServer{
    async getLog(){
        const push = this.push;
        if(!this.push) return super.getLog();
    }
    async execute(){
        if(this.companionBrowserId){
            EventBus.post(new CompanionHostConnected(this));
        }
        const push = this.push;
        if(!this.push) return;
        
        if(push.clipboard){
            clipboard.writeText(push.clipboard);
            console.log("Setting clipboard", push.clipboard);
        } 
        // if(push.url){
        //     shell.openExternal(push.url);
        // }
    }
    get notificationInfo(){
		const push = this.push;
        if(!push) return;

		if(!push.date){
			push.date = new Date().getTime();
		}
		if(push.date.formatDate){
			push.date = push.date.formatDate({full:true})
		}
        
		var title = push.title;
        var text = push.text;
		const setTitle = toSet => {
			if(title) return;
			title = toSet;
		};
		const setText = toSet => {
			if(text) return;
			text = toSet;
		};
        
        const handleClipboard = async push => {
            const clipboard = push.clipboard;
            if(!clipboard) return;
            
            setTitle(`Set Clipboard`);
            setText(`${clipboard}`);
        }
        const handleUrl = async push => {
            const url = push.url;
            if(!url) return;

			setTitle("Opened URL")
			setText(`${url}`);
        }
        const handleFiles = async push => {
            const files = push.files;
            if(!files || files.length == 0) return;
            
			setTitle("Received Files");
			setText("Opening now...");
        }
        const handleLocation = async push => {
            if(!push.location) return;

			setTitle("Location Requested");
			setText("Checking location...");
        }
        const handleSpeak = async push => {
            const say = push.say;
            if(!say) return;

			setTitle("Saying Out Loud");
            setText(say);
        }
        handleUrl(push);
        handleClipboard(push);
        handleFiles(push);
        handleLocation(push);
        handleSpeak(push);

        setTitle("Join");
        setText("Received Push");

		const notification = {
			"appName":"Join",
			"title":title,
            "text":text
		};
		Object.assign(notification, push);
		return notification;
	}
}

class GCMMediaInfo extends GCMServer{
    async modifyNotification(notification,index){
        await GCMMediaInfoBase.modifyNotification(this,notification,Util);
        notification.actions = [
			GCMMediaInfoBase.notificationActionBack,
			this.playing ? GCMMediaInfoBase.notificationActionPause : GCMMediaInfoBase.notificationActionPlay,
			GCMMediaInfoBase.notificationActionSkip
        ]
        notification.actions = notification.actions.map(action=>{
            const id = action.action;
            action.title = id.substring(0,1).toUpperCase() + id.substring(1);
            return action;
        })
        
	}	
	async handleNotificationClick(serviceWorker,action,data){
		return await GCMMediaInfoBase.handleNotificationClick(this,action,url=>console.log("Opening window",url));
	}
}
class GCMNotification extends GCMServer{}
class GCMDeviceNotOnLocalNetwork extends GCMServer{}