import { ApiServer } from "../api/apiserver.js";
import { AppContext } from '../appcontext.js';
import { EventBus } from "../eventbus.js";
import { ShowToast } from "../toast/toast.js";
import { Device } from "../device/device.js";
import { GoogleAccount } from "../google/account/googleaccount.js";
import { UtilDOM } from "../utildom.js";
export class Commands extends Array{
    constructor(initial,extraArgs){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!extraArgs){
            extraArgs = {}
        }
        this.push(new CommandNoteToSelf());
        this.push(new CommandSendCommand());
        if(Util.canReadClipboard){
            this.push(new CommandPaste());
        }
        this.push(new CommandWrite());
        this.push(new CommandSMS());
        this.push(new CommandNotifications());
        if(!extraArgs.hideSendTab){
            this.push(new CommandSendTab());
        }
        this.push(new CommandPasteSelectedText());
        this.push(new CommandUploadFiles());
        this.push(new CommandFiles());
        this.push(new CommandPushHistory());
        this.push(new CommandScreenshot());
        this.push(new CommandScreenCapture());
        this.push(new CommandRing());
        this.push(new CommandLocate());
        this.push(new CommandSay());
        this.push(new CommandOpenApp());
        this.push(new CommandApi());
        this.push(new CommandTestLocalNetwork());
        this.push(new CommandRenameDevice());
        this.push(new CommandDeleteDevice());
    }
}
class Command {
    //abstract
    getText(){}
    //abstract
    shouldEnable(device){}
    //abstract
    async execute(device){}
    showToast(args){
        EventBus.post(new ShowToast(args));
    }
    reloadDevices(){
        EventBus.post(new RequestLoadDevicesFromServer());
    }
    generateBookmarkletScript({device,apiKey,extraParams}){
        var extraString = "";
        if(extraParams){
            for(const extraProp in extraParams){
                const value = extraParams[extraProp];
                extraString += `&${extraProp}=' + encodeURIComponent(${value}) + '`;
            }
        }
        return `javascript:(function(){ var img = new Image(1,1); img.src = '${document.location.origin.replace("8081","8080")}/_ah/api/messaging/v1/sendPush?deviceId=${device.deviceId}&apikey=${apiKey}${extraString}' ; })();`;
    }
}
class CommandPush extends Command {
    async execute(device){
        const push = await this.customizePush({device,push:{}});
        if(!push) return;
        
        this.showToast({text:"Sending Push..."});
        const result = await device.sendPush(push);
        if(result.success){
            this.showToast({text:"Push sent!"});
        }else{
            await alert("Couldn't send push: " + result.errorMessage);
        };
        return result;		
    };
    //abstract
    async customizePush({device,push}){}
}
class CommandNoteToSelf extends CommandPush{
    getText(){
		return "Note To Self";
	}
	shouldEnable(device){
		return device.canReceiveNote();
    }
    async customizePush({device,push}){
        var text = await prompt("Text to send");
        if(!text) return;

        push.title = "Note To Self";
        push.text = text;
        return push;
    }
}
class CommandSendCommand extends CommandPush{
    getText(){
		return "Command";
	}
	shouldEnable(device){
		return true;
    }
    async customizePush({device,push}){
        var text = await prompt("Command to send");
        if(!text) return;

        push.text = text;
        return push;
    }
}
class CommandRing extends CommandPush{
    getText(){
		return "Ring";
	}
	shouldEnable(device){
		return device.canBeFound();
    }
    customizePush({device,push}){
        push.find = true;
        return push;
    }
}
class CommandLocate extends CommandPush{
    getText(){
		return "Locate";
	}
	shouldEnable(device){
		return true
    }
    customizePush({device,push}){
        push.location = true;
        return push;
    }
}
class CommandSay extends CommandPush{
    getText(){
		return "Speak";
	}
	shouldEnable(device){
		return true
    }
    async customizePush({device,push}){
        push.say = await prompt("What do you want to say out load on the device?");;
        return push;
    }
}
class CommandOpenApp extends CommandPush{
    getText(){
		return "Open App";
	}
	shouldEnable(device){
		return device.canOpenApps();
    }
    async customizePush({device,push}){
        push.app = await prompt("What app do you want to open?");;
        return push;
    }
}
class CommandPaste extends CommandPush{
	getText(){
		return "Paste";
	}
	shouldEnable(device){
		return device.canWrite();
    }
    async customizePush({device,push}){
        push.clipboard = await Util.clipboardText;
        if(!push.clipboard) return;

        return push;
    }
	
}
class CommandWrite extends CommandPush{
	getText(){
		return "Write";
	}
	shouldEnable(device){
		return device.canWrite();
    }
    async customizePush({device,push}){
        push.clipboard = await prompt(`What do you want to write on your ${device.deviceName}?`);
        if(!push.clipboard) return;

        return push;
    }
	
}
class CommandDeleteDevice extends Command{
	getText(){
		return "Delete";
	}
	shouldEnable(device){
		return true;
	}
	async execute(device){
        var confirm = window.confirm("Are you sure you want to delete " + device.deviceName + "?");
        if(!confirm) return;

        const result = await device.delete();
        if(!result.success){
            this.showToast({text:`Couldn't delete: ${result.errorMessage}`,isError:true});
            return;
        }
        
        this.showToast({text:`${device.deviceName} deleted`});
        this.reloadDevices();
	}
	
}
class CommandRenameDevice extends Command{
	getText(){
		return "Rename";
	}
	shouldEnable(device){
		return true;
	}
	async execute(device){
        var deviceName = await window.prompt(`What do you want to name ${device.deviceName}?`,device.deviceName);
        if(!deviceName) return;
        
        const result = await device.rename(deviceName);
		if(!result.success){
            this.showToast({text:`Couldn't rename: ${result.errorMessage}`,isError:true});
            return;
        }
        
        this.showToast({text:`${device.deviceName} renamed to ${deviceName}`});
        this.reloadDevices();
	}
	
}
class CommandApi extends Command{
	getText(){
		return "Join API";
	}
	shouldEnable(device){
		return true;
	}
	async execute(device){
        EventBus.post(new RequestToggleShowApiBuilder());
	}
	
}
class CommandScreenshot extends Command{
	getText(){
		return "Screenshot";
    }
    /**
     * 
     * @param {Device} device 
     */
	shouldEnable(device){
		return device.canTakeScreenshot();
	}
    /**
     * 
     * @param {Device} device 
     */
	async execute(device){
        await device.sendScreenshotRequest()
	}
	
}
class CommandScreenCapture extends Command{
	getText(){
		return "Screen Capture";
    }
    /**
     * 
     * @param {Device} device 
     */
	shouldEnable(device){
		return device.canTakeScreenCapture();
	}
    /**
     * 
     * @param {Device} device 
     */
	async execute(device){
       await device.sendScreenCaptureRequest();
	}
	
}
class CommandSMS extends Command{
	getText(){
		return "SMS";
    }
    /**
     * 
     * @param {Device} device 
     */
	shouldEnable(device){
		return device.canReceiveSms();
	}
    /**
     * 
     * @param {Device} device 
     */
	async execute(device){
       await EventBus.post(new RequestOpenSms(device));
	}
	
}
class CommandTestLocalNetwork extends Command{
	getText(){
		return "Local Network";
    }
    /**
     * 
     * @param {Device} device 
     */
	shouldEnable(device){
		return device.hasLocalNetworkCapabilities;
	}
    /**
     * 
     * @param {Device} device 
     */
	async execute(device){
        this.showToast({text:`Testing local network for ${device.deviceName} on ${device.deviceName}`});
        try{
            await device.requestLocalNetworkTestAndWaitForResponse();
            this.showToast({text:`Success!`});
        }catch(error){
            console.error("Can't contact on local network",error);
            this.showToast({text:`Seems like device is not on same local network...`,isError:true});
        }finally{           
            await EventBus.post(new RequestUpdateDevice(device));
        }
	}
	
}
class CommandUploadFiles extends CommandPush{
	getText(){
		return "Upload Files";
    }
    /**
     * 
     * @param {Device} device 
     */
	shouldEnable(device){
		return device.canReceiveFiles;
	}
    /**
     * 
     * @param {Device} device 
     */
	async customizePush({device,push}){
        const files = await UtilDOM.pickFiles();
        this.showToast({text:`Sending files to ${device.deviceName}...`});
        try{
            const uploadedFiles = await device.uploadFiles({files,token:GoogleAccount.getToken()});
            push.files = uploadedFiles;
            this.showToast({text:`Success!`});
            return push;
        }catch(error){
            console.error(error);
            this.showToast({text:`Can't send files to ${device.deviceName}`,isError:true});
        }
	}
	
}
class RequestUpdateDevice{
	constructor(device){
		this.device = device;
	}
}
class CommandFiles extends Command{
    getText(){
		return "Browse Files";
	}
	shouldEnable(device){
		return device.canBrowseFiles()
    }
    async execute(device){
        await EventBus.post(new RequestOpenFileBrowser(device));
        // await Util.openWindow(`${device.localNetworkServerAddress}files?token=${GoogleAccount.getToken()}`)
    }
}
class CommandPushHistory extends Command{
    getText(){
		return "Push History";
	}
	shouldEnable(device){
		return device.canShowPushHistory()
    }
    async execute(device){
        await EventBus.post(new RequestOpenPushHistory(device));
        // await Util.openWindow(`${device.localNetworkServerAddress}files?token=${GoogleAccount.getToken()}`)
    }
}
class CommandNotifications extends Command{
    getText(){
		return "Notifications";
	}
	shouldEnable(device){
		return device.canSendNotifications()
    }
    async execute(device){
        await EventBus.post(new RequestOpenNotifications(device));
    }
}
class CommandSendTab extends Command{
    getText(){
		return "Send Tab";
    }
    shouldEnable(device){
        return true;
    }
    async execute(device){
        await EventBus.post(new RequestGenerateButtonLink(this));
    }
    getLink({device,apiKey}){
        return this.generateBookmarkletScript({device,apiKey,extraParams: {url:"document.URL"}})        
    }
}
class CommandPasteSelectedText extends Command{
    getText(){
		return "Paste Selected";
    }
    shouldEnable(device){
        return true;
    }
    async execute(device){
        await EventBus.post(new RequestGenerateButtonLink(this));
    }
    getLink({device,apiKey}){
        return this.generateBookmarkletScript({device,apiKey,extraParams: {clipboard:"window.getSelection().toString()"}});
    }
}

class RequestLoadDevicesFromServer{}
class RequestToggleShowApiBuilder{}
class RequestOpenFileBrowser{
    constructor(device){
        this.device = device;
    }
}
class RequestOpenPushHistory{
    constructor(device){
        this.device = device;
    }
}
class RequestOpenSms{
    constructor(device){
        this.device = device;
    }
}
class RequestOpenNotifications{
    constructor(device){
        this.device = device;
    }
}
class RequestRefreshDevices{}
class RequestGenerateButtonLink{
    constructor(command){
        this.command = command;
    }
}