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
        if(initial.forEach || initial.length > 0){
            initial.forEach(command => {                
                if(!Util.isSubTypeOf(command, Command)) return;
                
                this.push(command);
            });
        }
        this.push(new CommandNoteToSelf());
        this.push(new CommandSendCommand());
        if(Util.canReadClipboard){
            this.push(new CommandPaste());
        }
        this.push(new CommandWrite());
        this.push(new CommandOpenUrl());
        this.push(new CommandSMS());
        this.push(new CommandPhoneCall());
        // this.push(new CommandNotifications());
        if(!extraArgs.hideBookmarklets){
            this.push(new CommandSendTab());
            this.push(new CommandPasteSelectedText());
        }
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
const lastExecutedCommandKey = "lastExecutedCommandKey";
class Command {
    constructor(){
        this.id = Util.getType(this);
    }
    static get lastExecutedCommand(){
        const commandName = AppContext.context.localStorage.get(lastExecutedCommandKey);
        if(!commandName) return null;

        const command = eval(`new ${commandName}()`);
        return command;
    }
    static set lastExecutedCommand(command){
        const commandName = Util.getType(command);
        AppContext.context.localStorage.set(lastExecutedCommandKey,commandName);
    }
    get shouldSaveAsLastExecutedCommand(){
        return true;
    }
    //abstract
    getText(){}
    //abstract
    shouldEnable(device){}
    async execute(device,devices=null){ 
        if(this.shouldSaveAsLastExecutedCommand){
            Command.lastExecutedCommand = this;
        } 
        return this.executeSpecific(device,devices);
    }
    //abstract
    async executeSpecific(device){}
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
    get supportsKeyboardShortcut(){
        return true;
    }
    get needsFocus(){
        return true;
    }
    matches(other){
        if(this.id && other.id){
            return this.id == other.id;
        }
        return Util.getType(this) == Util.getType(other);
    }
}
export class CommandPush extends Command {
    async executeSpecific(device,devices){
        const push = await this.customizePush({device,devices,push:{}});
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
    async customizePush({device,devices,push}){}
}
export class CommandNoteToSelf extends CommandPush{
    getText(){
		return "Note To Self";
    }
    getTextExtended(device){
        return "Create a note on your device";
    }
	shouldEnable(device){
		return device.canReceiveNote();
    }
    async customizePush({device,push}){
        var text = await prompt("Note To Self");
        if(!text) return;

        push.category = "Note To Self"
        push.title = "Note To Self";
        push.text = text;
        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" ><path d="M14,10V4.5L19.5,10M5,3C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V9L15,3H5Z"></path></svg>`;
    }
}
export class CommandOpenUrl extends CommandPush{
    getText(){
		return "Open URL";
    }
    getTextExtended(device){
        return "Open a URL on your device";
    }
	shouldEnable(device){
		return true;
    }
    async customizePush({device,push}){
        var text = await prompt("URL to Open");
        if(!text) return;

        push.url = text;
        return push;
    }
    get icon(){
        return `<svg style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z" /></svg>`;
    }
}
export class CommandSendCommand extends CommandPush{
    getText(){
		return "Command";
	}
    getTextExtended(device){
        if(!device) return "Send a command";
        
        let commandType = "Tasker";
        if(device.isBrowser){
            commandType = "Node-RED/EventGhost";
        }
        return `Send a ${commandType} command`;
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
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" width="96pt" height="96pt" viewBox="0 0 96 96" version="1.1" >
        <path d=" M 24.77 11.94 C 28.66 9.15 33.68 7.87 38.07 5.80 C 41.38 7.36 42.45 11.74 45.05 14.29 C 47.17 13.96 49.59 14.67 51.52 13.68 C 53.42 10.98 55.05 8.10 57.01 5.44 C 61.91 6.92 66.60 8.98 71.31 10.98 C 71.10 13.92 70.36 16.78 70.01 19.70 L 69.62 20.10 C 69.39 19.82 68.94 19.28 68.71 19.01 L 68.61 18.39 C 68.99 16.26 69.50 14.15 70.04 12.06 C 69.03 11.59 68.02 11.15 67.00 10.72 C 63.84 9.57 60.77 7.61 57.47 7.18 C 55.66 9.51 54.18 12.07 52.76 14.64 C 52.48 14.93 51.90 15.52 51.62 15.81 C 49.15 15.91 46.67 15.89 44.20 15.92 C 42.21 13.07 40.24 10.20 38.19 7.38 C 34.20 9.09 30.19 10.78 26.21 12.54 C 26.82 15.92 28.28 19.28 28.10 22.74 C 26.48 24.63 24.62 26.30 22.93 28.13 C 19.50 27.82 16.08 26.44 12.69 26.56 C 10.95 30.31 9.57 34.22 7.99 38.05 C 8.26 38.35 8.81 38.96 9.09 39.27 C 11.47 40.89 13.93 42.38 16.28 44.05 C 16.32 46.61 16.45 49.17 16.59 51.72 C 13.79 53.74 10.93 55.68 8.09 57.64 C 9.87 61.54 11.56 65.49 13.24 69.44 C 16.94 68.39 21.25 68.66 24.39 66.18 C 24.89 65.75 25.89 64.89 26.39 64.46 C 28.18 62.76 29.98 61.07 31.81 59.40 C 28.15 54.37 27.92 48.05 27.49 42.09 C 30.09 39.37 31.30 35.62 34.07 33.05 C 38.57 28.49 45.28 26.33 51.60 27.45 C 55.88 28.53 59.28 24.95 63.12 23.72 C 64.83 22.94 66.47 22.02 68.00 20.91 C 72.76 20.92 76.43 17.21 80.79 15.69 C 82.07 14.60 84.02 16.32 82.89 17.74 C 80.74 20.39 78.17 22.66 76.02 25.31 C 78.95 24.96 81.77 23.94 84.73 23.89 C 86.62 28.58 88.97 33.10 90.55 37.91 C 87.81 40.05 84.61 41.65 82.06 43.97 C 81.92 46.04 82.01 48.12 82.00 50.19 C 84.96 52.12 88.01 53.91 90.84 56.04 C 89.01 60.81 87.34 65.69 84.99 70.23 C 81.48 69.72 78.00 69.01 74.51 68.38 C 73.08 69.87 71.62 71.35 70.15 72.81 C 70.98 76.25 71.74 79.70 72.33 83.18 C 67.68 85.29 62.97 87.88 58.05 89.00 C 55.73 86.39 54.11 83.23 51.88 80.54 C 49.93 80.64 47.98 80.68 46.02 80.63 C 43.77 83.35 42.09 86.48 40.03 89.35 C 35.05 88.14 30.43 85.80 25.67 83.95 C 25.86 80.77 26.53 77.66 27.28 74.57 C 26.64 73.99 26.01 73.40 25.40 72.80 C 32.99 69.74 40.60 66.58 47.86 62.80 L 48.57 62.44 C 49.27 62.99 49.96 63.55 50.65 64.10 C 48.73 64.27 46.89 64.74 45.11 65.50 C 52.59 68.06 60.87 63.55 64.81 57.09 C 63.05 57.86 61.31 58.69 59.61 59.58 C 59.76 59.04 60.08 57.97 60.23 57.43 C 63.93 56.19 67.47 54.53 70.98 52.84 C 69.26 51.76 67.49 50.76 65.69 49.84 L 65.58 49.76 C 64.99 48.61 64.06 48.00 62.76 47.94 L 62.73 47.92 C 60.88 46.61 59.05 45.28 57.21 43.96 C 63.12 36.53 70.34 30.26 76.20 22.78 C 76.34 22.64 76.63 22.36 76.78 22.22 C 78.89 20.66 80.65 18.70 82.18 16.58 C 80.46 17.16 78.69 17.74 77.25 18.89 C 77.15 18.97 76.95 19.11 76.85 19.19 C 64.19 24.81 51.98 31.42 39.50 37.45 C 36.02 39.22 32.41 40.75 29.13 42.89 C 29.55 43.10 30.38 43.53 30.80 43.74 L 31.74 44.22 C 32.61 45.04 34.35 46.68 35.21 47.50 C 33.85 46.85 31.12 45.54 29.75 44.89 C 29.38 49.98 30.27 55.42 33.87 59.29 C 30.46 64.52 24.43 67.46 20.64 72.46 C 20.56 72.51 20.42 72.63 20.34 72.69 C 18.45 73.96 16.60 75.36 15.33 77.29 C 17.16 76.89 18.93 76.22 20.44 75.09 C 21.10 74.66 21.77 74.25 22.46 73.86 L 25.47 73.09 C 25.28 73.72 24.90 74.98 24.71 75.61 C 21.21 74.43 17.56 80.02 14.20 77.76 C 14.23 77.40 14.28 76.69 14.31 76.34 C 16.71 73.83 19.53 71.76 21.92 69.24 C 18.67 69.75 15.52 70.93 12.21 70.98 C 10.32 66.30 8.01 61.79 6.41 57.00 C 9.20 54.93 12.12 53.02 14.99 51.06 C 15.00 48.96 15.00 46.87 15.03 44.77 C 12.09 42.79 9.03 40.97 6.13 38.93 C 7.80 34.11 9.71 29.36 11.82 24.70 C 15.33 25.00 18.72 26.01 22.21 26.35 C 24.03 25.31 25.24 23.46 26.78 22.06 C 26.10 18.69 25.07 15.37 24.77 11.94 Z"></path>
        <path d=" M 57.47 7.18 C 60.77 7.61 63.84 9.57 67.00 10.72 L 66.06 10.54 C 67.34 13.00 68.07 15.69 68.61 18.39 L 68.71 19.01 C 68.53 19.49 68.17 20.44 68.00 20.91 C 66.47 22.02 64.83 22.94 63.12 23.72 C 58.43 22.61 53.94 20.42 49.05 20.36 C 38.44 20.17 28.01 26.68 23.81 36.48 C 22.06 41.49 20.49 46.94 21.97 52.24 C 22.82 56.53 24.92 60.38 26.39 64.46 C 25.89 64.89 24.89 65.75 24.39 66.18 C 20.94 67.10 17.44 67.83 13.93 68.48 C 12.10 65.08 10.66 61.49 9.25 57.90 C 11.52 55.73 15.50 54.84 16.59 51.72 C 16.45 49.17 16.32 46.61 16.28 44.05 C 13.93 42.38 11.47 40.89 9.09 39.27 C 9.67 35.24 11.29 31.44 13.12 27.84 C 16.48 26.85 20.14 29.40 23.63 28.50 C 25.72 26.77 27.43 24.64 29.32 22.70 C 28.59 19.47 27.84 16.24 27.41 12.94 C 30.90 11.59 34.20 9.27 37.94 8.83 C 40.20 11.06 41.65 13.93 43.47 16.49 C 46.43 16.63 49.39 16.74 52.35 16.49 C 52.45 16.02 52.66 15.10 52.76 14.64 C 54.18 12.07 55.66 9.51 57.47 7.18 Z"></path>
        <path d=" M 66.06 10.54 L 67.00 10.72 C 68.02 11.15 69.03 11.59 70.04 12.06 C 69.50 14.15 68.99 16.26 68.61 18.39 C 68.07 15.69 67.34 13.00 66.06 10.54 Z"></path>
        <path d=" M 77.25 18.89 C 78.69 17.74 80.46 17.16 82.18 16.58 C 80.65 18.70 78.89 20.66 76.78 22.22 C 76.80 21.46 76.83 19.95 76.85 19.19 C 76.95 19.11 77.15 18.97 77.25 18.89 Z"></path>
        <path d=" M 39.50 37.45 C 51.98 31.42 64.19 24.81 76.85 19.19 C 75.61 20.48 74.18 21.58 72.53 22.30 C 60.18 28.16 48.14 34.67 35.79 40.54 C 33.97 41.34 32.38 42.54 30.80 43.74 C 30.38 43.53 29.55 43.10 29.13 42.89 C 32.41 40.75 36.02 39.22 39.50 37.45 Z"></path>
        <path d=" M 76.85 19.19 C 76.83 19.95 76.80 21.46 76.78 22.22 C 76.63 22.36 76.34 22.64 76.20 22.78 C 75.61 22.91 74.43 23.17 73.84 23.30 C 74.29 24.93 72.87 25.97 72.00 27.05 C 67.05 32.31 62.01 37.50 57.33 42.98 C 56.53 45.98 60.90 46.61 62.73 47.92 L 62.76 47.94 C 63.09 49.48 64.02 50.08 65.58 49.76 L 65.69 49.84 C 66.20 50.30 67.23 51.22 67.75 51.69 C 56.93 50.27 46.58 46.49 35.89 44.41 C 35.22 44.48 33.87 44.63 33.20 44.70 C 32.84 44.58 32.11 44.34 31.74 44.22 L 30.80 43.74 C 32.38 42.54 33.97 41.34 35.79 40.54 C 48.14 34.67 60.18 28.16 72.53 22.30 C 74.18 21.58 75.61 20.48 76.85 19.19 Z"></path>
        <path d=" M 24.06 38.21 C 27.19 29.64 35.13 23.14 44.10 21.64 C 49.04 21.02 54.22 21.32 58.81 23.37 C 59.63 25.70 56.23 26.00 54.75 26.82 C 49.53 26.41 43.98 25.79 39.19 28.44 C 33.12 31.06 29.81 37.16 26.70 42.52 C 27.39 48.21 27.24 54.31 30.74 59.20 C 29.82 60.17 28.97 61.22 27.84 61.96 C 26.31 62.16 25.88 60.50 25.28 59.47 C 21.95 52.95 21.42 45.05 24.06 38.21 Z"></path>
        <path d=" M 76.20 22.78 C 76.34 22.64 76.63 22.36 76.78 22.22 C 76.63 22.36 76.34 22.64 76.20 22.78 Z"></path>
        <path d=" M 74.64 27.87 C 77.93 27.39 81.27 26.48 84.60 27.17 L 84.73 27.18 C 86.06 30.57 87.50 33.91 89.10 37.17 C 86.24 39.26 83.43 41.49 80.25 43.08 L 79.21 43.58 C 78.92 45.85 78.95 48.15 79.32 50.41 L 80.41 50.95 C 81.81 51.59 83.10 52.44 84.34 53.35 L 84.42 53.60 C 84.51 53.85 84.68 54.34 84.76 54.59 C 85.76 55.43 86.81 56.21 87.85 57.00 C 86.67 60.54 85.24 63.98 83.90 67.46 C 80.49 67.18 77.14 66.23 73.69 66.35 L 73.29 67.08 C 72.53 68.91 71.00 70.21 69.58 71.53 L 68.77 71.48 C 68.51 71.47 68.00 71.44 67.74 71.42 C 68.09 74.99 69.14 78.44 69.55 81.99 C 66.10 83.33 62.83 85.44 59.11 85.92 C 56.62 84.12 55.42 80.92 53.55 78.48 C 50.50 78.17 47.43 78.18 44.38 78.48 C 42.58 81.08 41.10 83.94 38.95 86.29 C 35.24 85.90 31.87 83.84 28.48 82.35 C 28.46 80.37 28.36 78.39 28.20 76.42 C 28.10 75.32 28.81 74.35 29.16 73.35 C 30.66 72.76 32.15 72.14 33.64 71.50 C 38.62 73.23 43.67 75.32 49.02 75.30 C 55.56 74.82 62.15 72.53 66.99 67.99 C 73.47 62.35 76.74 53.47 76.25 44.99 C 76.06 39.67 71.79 35.17 72.85 29.75 C 73.15 28.85 73.75 28.23 74.64 27.87 Z"></path>
        <path d=" M 65.91 37.02 C 68.16 34.54 70.42 32.07 72.85 29.75 C 71.79 35.17 76.06 39.67 76.25 44.99 C 76.74 53.47 73.47 62.35 66.99 67.99 C 62.15 72.53 55.56 74.82 49.02 75.30 C 43.67 75.32 38.62 73.23 33.64 71.50 C 37.00 69.93 40.42 68.48 43.85 67.06 C 51.90 69.34 61.06 65.55 65.47 58.50 C 66.99 55.52 71.47 56.18 72.79 53.07 C 72.45 51.13 70.59 50.44 69.10 49.56 C 68.61 45.26 68.21 40.81 65.91 37.02 Z"></path>
        <path d=" M 67.46 36.95 C 68.39 35.78 69.42 34.69 70.72 33.93 C 73.68 39.24 74.91 45.42 74.01 51.46 C 72.73 50.58 71.46 49.70 70.20 48.80 C 70.04 44.71 69.07 40.71 67.46 36.95 Z"></path>
        <path d=" M 79.21 43.58 L 80.25 43.08 C 80.41 45.70 80.46 48.33 80.41 50.95 L 79.32 50.41 C 78.95 48.15 78.92 45.85 79.21 43.58 Z"></path>
        <path d=" M 33.20 44.70 C 33.87 44.63 35.22 44.48 35.89 44.41 C 46.58 46.49 56.93 50.27 67.75 51.69 C 68.29 51.99 69.38 52.59 69.92 52.88 C 65.80 54.70 61.64 56.44 57.58 58.40 L 56.61 58.87 C 53.85 59.86 51.16 61.06 48.57 62.44 L 47.86 62.80 C 39.28 66.20 30.85 70.04 22.46 73.86 C 21.77 74.25 21.10 74.66 20.44 75.09 C 20.42 74.49 20.37 73.29 20.34 72.69 C 20.42 72.63 20.56 72.51 20.64 72.46 C 28.07 66.71 34.86 60.09 41.70 53.64 L 41.39 50.56 C 41.85 51.29 42.78 52.73 43.24 53.46 C 43.05 52.77 42.67 51.39 42.48 50.70 C 39.28 48.87 36.19 46.85 33.20 44.70 Z"></path>
        <path d=" M 62.76 47.94 C 64.06 48.00 64.99 48.61 65.58 49.76 C 64.02 50.08 63.09 49.48 62.76 47.94 Z"></path>
        <path d=" M 33.87 59.29 C 35.35 55.65 39.22 53.76 41.39 50.56 L 41.70 53.64 C 34.86 60.09 28.07 66.71 20.64 72.46 C 24.43 67.46 30.46 64.52 33.87 59.29 Z"></path>
        <path d=" M 66.35 59.39 C 67.77 57.03 70.58 56.39 73.03 55.64 C 70.12 64.40 62.22 71.32 53.09 72.84 C 48.09 73.46 42.81 73.30 38.20 71.06 C 42.37 66.84 48.27 70.06 53.25 68.42 C 58.64 67.34 63.23 63.83 66.35 59.39 Z"></path>
        <path d=" M 56.61 58.87 L 57.58 58.40 C 58.27 58.97 58.96 59.54 59.65 60.12 C 56.34 60.32 53.51 62.17 50.66 63.66 C 50.79 63.08 51.06 61.92 51.19 61.34 C 53.06 60.67 54.88 59.86 56.61 58.87 Z"></path>
        <path d=" M 15.33 77.29 C 16.60 75.36 18.45 73.96 20.34 72.69 C 20.37 73.29 20.42 74.49 20.44 75.09 C 18.93 76.22 17.16 76.89 15.33 77.29 Z"></path>
        </svg>`;
    }
}
export class CommandRing extends CommandPush{
    getText(){
		return "Ring";
	}
    getTextExtended(device){
        return `Ring your device`;
    }
	shouldEnable(device){
		return device.canBeFound();
    }
    customizePush({device,push}){
        push.find = true;
        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M16,17V10.5C16,8 14,6 11.5,6C9,6 7,8 7,10.5V17H16M18,16L20,18V19H3V18L5,16V10.5C5,7.43 7.13,4.86 10,4.18V3.5A1.5,1.5 0 0,1 11.5,2A1.5,1.5 0 0,1 13,3.5V4.18C15.86,4.86 18,7.43 18,10.5V16M11.5,22A2,2 0 0,1 9.5,20H13.5A2,2 0 0,1 11.5,22M19.97,10C19.82,7.35 18.46,5 16.42,3.58L17.85,2.15C20.24,3.97 21.82,6.79 21.97,10H19.97M6.58,3.58C4.54,5 3.18,7.35 3,10H1C1.18,6.79 2.76,3.97 5.15,2.15L6.58,3.58Z"></path></svg>`;
    }
    get needsFocus(){
        return false;
    }
}
export class CommandLocate extends CommandPush{
    getText(){
		return "Locate";
	}
    getTextExtended(device){
        return `Locate your device`;
    }
	shouldEnable(device){
		return true
    }
    customizePush({device,push}){
        push.location = true;
        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"></path></svg>`;
    }
    get needsFocus(){
        return false;
    }
}
export class CommandSay extends CommandPush{
    getText(){
		return "Speak";
	}
    getTextExtended(device){
        return `Say something out loud on your device`;
    }
	shouldEnable(device){
		return true
    }
    async customizePush({device,push}){
        push.say = await prompt("What do you want to say out load on the device?");;
        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M9,5A4,4 0 0,1 13,9A4,4 0 0,1 9,13A4,4 0 0,1 5,9A4,4 0 0,1 9,5M9,15C11.67,15 17,16.34 17,19V21H1V19C1,16.34 6.33,15 9,15M16.76,5.36C18.78,7.56 18.78,10.61 16.76,12.63L15.08,10.94C15.92,9.76 15.92,8.23 15.08,7.05L16.76,5.36M20.07,2C24,6.05 23.97,12.11 20.07,16L18.44,14.37C21.21,11.19 21.21,6.65 18.44,3.63L20.07,2Z"></path></svg>`;
    }
}
export class CommandOpenApp extends CommandPush{
    getText(){
		return "Open App";
	}
    getTextExtended(device){
        return `Open an app on your device`;
    }
	shouldEnable(device){
		return device.canOpenApps();
    }
    async customizePush({device,push}){
        push.app = await prompt("What app do you want to open?");;
        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M8,11.5A1.25,1.25 0 0,0 6.75,12.75A1.25,1.25 0 0,0 8,14A1.25,1.25 0 0,0 9.25,12.75A1.25,1.25 0 0,0 8,11.5M16,11.5A1.25,1.25 0 0,0 14.75,12.75A1.25,1.25 0 0,0 16,14A1.25,1.25 0 0,0 17.25,12.75A1.25,1.25 0 0,0 16,11.5M12,7C13.5,7 14.9,7.33 16.18,7.91L18.34,5.75C18.73,5.36 19.36,5.36 19.75,5.75C20.14,6.14 20.14,6.77 19.75,7.16L17.95,8.96C20.41,10.79 22,13.71 22,17H2C2,13.71 3.59,10.79 6.05,8.96L4.25,7.16C3.86,6.77 3.86,6.14 4.25,5.75C4.64,5.36 5.27,5.36 5.66,5.75L7.82,7.91C9.1,7.33 10.5,7 12,7Z"></path></svg>`;
    }
}
export class CommandPaste extends CommandPush{
	getText(){
		return "Paste";
	}
    getTextExtended(device){
        return `Paste clipboard on your device`;
    }
	shouldEnable(device){
		return device.canWrite();
    }
    async customizePush({device,push}){
        push.clipboard = await Util.clipboardText;
        if(!push.clipboard) return;

        return push;
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" ><path d="M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"></path></svg>`;
    }
    get needsFocus(){
        return false;
    }
	
}
export class CommandWrite extends CommandPush{
	getText(){
		return "Write";
	}
    getTextExtended(device){
        return `Write text in an app on your device`;
    }
	shouldEnable(device){
		return device.canWrite();
    }
    async customizePush({device,push}){
        push.clipboard = await prompt(`What do you want to write on your ${device.deviceName}?`);
        if(!push.clipboard) return;

        return push;
    }
	get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"></path></svg>`;
    }
}
export class CommandDeleteDevice extends Command{
	getText(){
		return "Delete";
	}
    getTextExtended(device){
        return `Delete device`;
    }
	shouldEnable(device){
		return true;
	}
	async executeSpecific(device){
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
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>`;
    }
	
}
export class CommandRenameDevice extends Command{
	getText(){
		return "Rename";
	}
    getTextExtended(device){
        return `Rename device`;
    }
	shouldEnable(device){
		return true;
	}
	async executeSpecific(device){
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
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M18,17H10.5L12.5,15H18M6,17V14.5L13.88,6.65C14.07,6.45 14.39,6.45 14.59,6.65L16.35,8.41C16.55,8.61 16.55,8.92 16.35,9.12L8.47,17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"></path></svg>`;
    }
	
}
export class CommandApi extends Command{
	getText(){
		return "Join API";
	}
    getTextExtended(device){
        return `Create a Join API link for your device`;
    }
	shouldEnable(device){
		return true;
	}
	async executeSpecific(device){
        EventBus.post(new RequestToggleShowApiBuilder());
	}
    get icon(){
        return `<svg style="width:24px;height:24px" viewBox="0 0 24 24">
        <path d="M3 1C1.89 1 1 1.89 1 3V14C1 15.11 1.89 16 3 16H14C15.11 16 16 15.11 16 14V11H14V14H3V3H14V5H16V3C16 1.89 15.11 1 14 1M9 7C7.89 7 7 7.89 7 9V12H9V9H20V20H9V18H7V20C7 21.11 7.89 22 9 22H20C21.11 22 22 21.11 22 20V9C22 7.89 21.11 7 20 7H9" />
    </svg>`;
    }
	
}
export class CommandScreenshot extends Command{
	getText(){
		return "Screenshot";
    }
    getTextExtended(device){
        return `Take a screenshot`;
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
	async executeSpecific(device){
        await device.sendScreenshotRequest()
	}
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"></path></svg>`;
    }
	
    get needsFocus(){
        return false;
    }
}
export class CommandScreenCapture extends Command{
	getText(){
		return "Screen Capture";
    }
    getTextExtended(device){
        return `Toggle Screen Capture`;
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
	async executeSpecific(device){
       await device.sendScreenCaptureRequest();
	}
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M4,2A1,1 0 0,0 3,3V4A1,1 0 0,0 4,5H5V14H11V16.59L6.79,20.79L8.21,22.21L11,19.41V22H13V19.41L15.79,22.21L17.21,20.79L13,16.59V14H19V5H20A1,1 0 0,0 21,4V3A1,1 0 0,0 20,2H4Z"></path></svg>`;
    }
    get needsFocus(){
        return false;
    }
	
}
export class CommandSMS extends Command{
	getText(){
		return "SMS";
    }
    getTextExtended(device){
        return `Send an SMS Message`;
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
	async executeSpecific(device){
       await EventBus.post(new RequestOpenSms(device));
    }
    get icon(){
        return `<svg style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M20,20H7A2,2 0 0,1 5,18V8.94L2.23,5.64C2.09,5.47 2,5.24 2,5A1,1 0 0,1 3,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20M8.5,7A0.5,0.5 0 0,0 8,7.5V8.5A0.5,0.5 0 0,0 8.5,9H18.5A0.5,0.5 0 0,0 19,8.5V7.5A0.5,0.5 0 0,0 18.5,7H8.5M8.5,11A0.5,0.5 0 0,0 8,11.5V12.5A0.5,0.5 0 0,0 8.5,13H18.5A0.5,0.5 0 0,0 19,12.5V11.5A0.5,0.5 0 0,0 18.5,11H8.5M8.5,15A0.5,0.5 0 0,0 8,15.5V16.5A0.5,0.5 0 0,0 8.5,17H13.5A0.5,0.5 0 0,0 14,16.5V15.5A0.5,0.5 0 0,0 13.5,15H8.5Z" /></svg>`;
    }
	
}
export class CommandPhoneCall extends Command{
	getText(){
		return "Phone Call";
    }
    getTextExtended(device){
        return `Call a phone number`;
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
	async executeSpecific(device){
        const phoneNumber = await prompt("What phone number do you want to call?");
        if(!phoneNumber) return;

        await device.call(phoneNumber);
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M15,12H17A5,5 0 0,0 12,7V9A3,3 0 0,1 15,12M19,12H21C21,7 16.97,3 12,3V5C15.86,5 19,8.13 19,12M20,15.5C18.75,15.5 17.55,15.3 16.43,14.93C16.08,14.82 15.69,14.9 15.41,15.18L13.21,17.38C10.38,15.94 8.06,13.62 6.62,10.79L8.82,8.59C9.1,8.31 9.18,7.92 9.07,7.57C8.7,6.45 8.5,5.25 8.5,4A1,1 0 0,0 7.5,3H4A1,1 0 0,0 3,4A17,17 0 0,0 20,21A1,1 0 0,0 21,20V16.5A1,1 0 0,0 20,15.5Z"></path></svg>`;
    }
	
}
export class CommandTestLocalNetwork extends Command{
	getText(){
		return "Local Network";
    }
    getTextExtended(device){
        return `Check if device is on your Local Network`;
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
	async executeSpecific(device){
        this.showToast({text:`Testing local network for ${device.deviceName} on ${device.deviceName}`});
        try{
            const result = await device.requestLocalNetworkTestAndWaitForResponse();
            if(result){
                this.showToast({text:`Success!`});
            }else{
                this.showToast({text:`Seems like device is not on same local network...`,isError:true});
            }
        }catch(error){
            console.error("Can't contact on local network",error);
            this.showToast({text:`Seems like device is not on same local network...`,isError:true});
        }finally{           
            await EventBus.post(new RequestUpdateDevice(device));
        }
	}
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M10,2C8.89,2 8,2.89 8,4V7C8,8.11 8.89,9 10,9H11V11H2V13H6V15H5C3.89,15 3,15.89 3,17V20C3,21.11 3.89,22 5,22H9C10.11,22 11,21.11 11,20V17C11,15.89 10.11,15 9,15H8V13H16V15H15C13.89,15 13,15.89 13,17V20C13,21.11 13.89,22 15,22H19C20.11,22 21,21.11 21,20V17C21,15.89 20.11,15 19,15H18V13H22V11H13V9H14C15.11,9 16,8.11 16,7V4C16,2.89 15.11,2 14,2H10M10,4H14V7H10V4M5,17H9V20H5V17M15,17H19V20H15V17Z"></path></svg>`;
    }
	
}
export class CommandUploadFiles extends CommandPush{
	getText(){
		return "Upload Files";
    }
    getTextExtended(device){
        return `Send files to your device`;
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
        const { ControlDialogSingleChoice, ControlDialogInput } = await import("../dialog/controldialog.js");
        const choices = [{id:"local",label:"Local Files"},{id:"web",label:"From Web"}]
        const localOrWeb = await ControlDialogSingleChoice.showAndWait({choices,choiceToLabelFunc:choice=>choice.label})
        if(localOrWeb == "local"){
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
	    }else{
            const file = await ControlDialogInput.showAndWait({title:"Input the URL of the file to send", placeholder:"File URL"});
            if(!file) return;

            push.files = [file]
            return push;
        }
    }
    get icon(){
        return `<svg style="width:24px;height:24px" viewBox="0 0 24 24">
        <path d="M14,2L20,8V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2H14M18,20V9H13V4H6V20H18M12,12L16,16H13.5V19H10.5V16H8L12,12Z" />
    </svg>`;
    }
	
}
class RequestUpdateDevice{
	constructor(device){
		this.device = device;
	}
}
export class CommandFiles extends Command{
    getText(){
		return "Browse Files";
	}
    getTextExtended(device){
        return `Browse the files on your device`;
    }
	shouldEnable(device){
		return device.canBrowseFiles()
    }
    async executeSpecific(device){
        await EventBus.post(new RequestOpenFileBrowser(device));
        // await Util.openWindow(`${device.localNetworkServerAddress}files?token=${GoogleAccount.getToken()}`)
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M16 0H8C6.9 0 6 .9 6 2V18C6 19.1 6.9 20 8 20H20C21.1 20 22 19.1 22 18V6L16 0M20 18H8V2H15V7H20V18M4 4V22H20V24H4C2.9 24 2 23.1 2 22V4H4Z"></path></svg>`;
    }
}
export class CommandPushHistory extends Command{
    getText(){
		return "Push History";
	}
    getTextExtended(device){
        return `Check device's push history`;
    }
	shouldEnable(device){
		return device.canShowPushHistory()
    }
    async executeSpecific(device){
        await EventBus.post(new RequestOpenPushHistory(device));
        // await Util.openWindow(`${device.localNetworkServerAddress}files?token=${GoogleAccount.getToken()}`)
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"></path></svg>`;
    }
}
export class CommandNotifications extends Command{
    getText(){
		return "Notifications";
	}
    getTextExtended(device){
        return `Check device's notifications`;
    }
	shouldEnable(device){
		return device.canSendNotifications()
    }
    async executeSpecific(device){
        await EventBus.post(new RequestOpenNotifications(device));
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path d="M0 0h24v24H0V0z"></path>
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"></path></svg>`;
    }
}
export class CommandSendTab extends Command{
    getText(){
		return "Send Tab";
    }
    getTextExtended(device){
        return `Send current tab to your device`;
    }
    shouldEnable(device){
        return true;
    }
    async executeSpecific(device){
        await EventBus.post(new RequestGenerateButtonLink(this));
    }
    getLink({device,apiKey}){
        return this.generateBookmarkletScript({device,apiKey,extraParams: {url:"document.URL"}})        
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"></path></svg>`;
    }    
    get supportsKeyboardShortcut(){
        return false;
    }
}
export class CommandPasteSelectedText extends Command{
    getText(){
		return "Paste Selected";
    }
    getTextExtended(device){
        return `Paste the selected text on your device`;
    }
    shouldEnable(device){
        return true;
    }
    async executeSpecific(device){
        await EventBus.post(new RequestGenerateButtonLink(this));
    }
    getLink({device,apiKey}){
        return this.generateBookmarkletScript({device,apiKey,extraParams: {clipboard:"window.getSelection().toString()"}});
    }
    get icon(){
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" id="devicebuttonimage" class=" replaced-svg"><path d="M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"></path></svg>`;
    }
    get supportsKeyboardShortcut(){
        return false;
    }
}
export class CommandRepeatLastCommand extends Command{
    getText(){
		return "Repeat Last";
    }
    getTextExtended(device){
        return `Repeat the last performed command`;
    }
    shouldEnable(device){
        return true;
    }
    async executeSpecific(device){
        const command = Command.lastExecutedCommand;
        if(!command) return;

        return command.execute(device);
    }
    get shouldSaveAsLastExecutedCommand(){
        return false;
    }
    get needsFocus(){
        const command = Command.lastExecutedCommand;
        if(!command) return false;

        return command.needsFocus;
    }
}
export class CommandShowAppWindow extends Command{
    getText(){
		return "Show Window";
    }
    getTextExtended(device){
        return `Show the app window`;
    }
    shouldEnable(device){
        return true;
    }
    async executeSpecific(device){
        EventBus.post({},"RequestFocusWindow");
    }
    get shouldSaveAsLastExecutedCommand(){
        return false;
    }
}
class CommandMedia extends Command{    
    async executeSpecific(device,devices){
        const {DBMediaInfos} = await import("../media/dbmediainfo.js");
        const db = new DBMediaInfos(DB.get());
        const latest = await db.getLatest(devices);
        if(!latest) return;

        console.log("Latest Media Info", latest);
        await this.doMediaCommand(latest.device,latest.packageName);
    }
    shouldEnable(device){
        return device.canBeMediaControlled();
    }
    //abstract
    async doMediaCommand(device,packageName){}
    get shouldSaveAsLastExecutedCommand(){
        return false;
    }
    get needsFocus(){
        return false;
    }
}
export class CommandSkipSong extends CommandMedia{
    getText(){
		return "Skip Song";
    }
    getTextExtended(device){
        return `Skip the currently playing song`;
    }
    async doMediaCommand(device,packageName){
        await device.pressNext(packageName);
    }
}
export class CommandPreviousSong extends CommandMedia{
    getText(){
		return "Previous Song";
    }
    getTextExtended(device){
        return `Press the back key on the currently playing media app`;
    }
    async doMediaCommand(device,packageName){
        await device.pressBack(packageName);
    }
}
export class CommandPlayPause extends CommandMedia{
    getText(){
		return "Play/Pause";
    }
    getTextExtended(device){
        return `Toggle playing on the currently playing media app`;
    }
    async doMediaCommand(device,packageName){
        await device.togglePlayPause(packageName);
    }
}
export class CommandCustom extends Command{
    constructor(args={idFromArgs, iconFromArgs,text,textExtendedGetter,shouldEnableFromArgs,needsFocusFromArgs}){
        super();
        Object.assign(this,args);
        if(!args.idFromArgs) throw "Must set custom command id!";
        this.id = args.idFromArgs;
    }
    getText(){
		return this.text;
    }
    getTextExtended(device){
        return this.textExtendedGetter(device);
    }
    shouldEnable(device){
        if(!this.shouldEnableFromArgs) return true;

        return this.shouldEnableFromArgs(device);
    }
    async executeSpecific(device){
        await EventBus.post(new CommandCustomExecuted(this,device));
    }
    get shouldSaveAsLastExecutedCommand(){
        return true;
    }
    get icon(){
        return this.iconFromArgs;
    }
    get needsFocus(){
        return this.needsFocusFromArgs ? true : false;
    }
}

class CommandCustomExecuted{
    constructor(commandCustom,device){
        this.commandCustom = commandCustom;
        this.device = device;
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