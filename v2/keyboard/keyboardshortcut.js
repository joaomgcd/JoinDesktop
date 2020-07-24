import { ControlDialogOk } from "../dialog/controldialog.js";
import { DialogOk } from "../dialog/dialog.js";
import { EventBus } from "../eventbus.js";
import { UtilDOM } from "../utildom.js";

export class ControlKeyboardShortcut{
    static async setupNewShortcut(){
        const controlDialog = new ControlDialogOk({
            dialog:new DialogOk({title:"New Shortcut",text:"Press the desired key combination now.",showCancel:true})
        });
        await controlDialog.show(null);
        let current = null;
        const enableDisableButton = () => {
            controlDialog.enableDisableButton(current ? true : false);
        }
        enableDisableButton();
        const keyListenerDown = async (e)=>{
            UtilDOM.preventEventPropagation(e);
            try{   
                const shortcut = new KeyboardShortcut(e);
                if(!shortcut.hasSpecialKey) return;
                
                console.log(e);                
                if(shortcut.isValid){
                    current = shortcut;
                }else{
                    current = null;
                }
                controlDialog.dialog.text = shortcut.toString();
                await controlDialog.render();
            }finally{
                enableDisableButton();
            }
        }
        const keyListenerUp = e => {
            UtilDOM.preventEventPropagation(e);
            enableDisableButton();
        }
        window.addEventListener("keydown",keyListenerDown,true);
        window.addEventListener("keyup",keyListenerUp,true);
        const button = await EventBus.waitFor("DialogButtonClicked",9999999999);
        if(button.isCancel){
            current = null;
        }
        window.removeEventListener("keydown",keyListenerDown,true);
        window.removeEventListener("keyup",keyListenerUp,true);
        await controlDialog.dispose();
        return current;
    }
}

export class KeyboardShortcuts extends Array{
    constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!initial){
            initial = [];
        }
        initial.forEach(shortcut => {
            this.push(shortcut)
        });
    }
}
export class KeyboardShortcut{
    constructor(keyEvent){
        this.shiftKey = keyEvent.shiftKey;
        this.ctrlKey = keyEvent.ctrlKey;
        this.altKey = keyEvent.altKey;
        this.keyCode = keyEvent.keyCode;
        this.code = keyEvent.code;
    }
    get hasShift(){
        return this.shiftKey;
    }
    get hasControl(){
        return this.ctrlKey;
    }
    get hasAlt(){
        return this.altKey;
    }
    get isShift(){
        return this.keyCode == 16;
    }
    get isControl(){
        return this.keyCode == 17;
    }
    get isAlt(){
        return this.keyCode == 18;
    }
    get hasSpecialKey(){
        return this.hasShift || this.hasControl || this.hasAlt
    }
    get isSpecialKey(){
        return this.isShift || this.isControl || this.isAlt;
    }
    get isValid(){
        return this.hasSpecialKey && !this.isSpecialKey;
    }
    get keyName(){
        return this.code.replace("Key","");
    }
    toString(){
        let text = "";
        if(this.hasControl){
            text = `Control + ${text}`;
        }
        if(this.hasShift){
            text = `Shift + ${text}`;
        }
        if(this.hasAlt){
            text = `Alt + ${text}`;
        }
        if(!this.isSpecialKey){
            text += this.keyName;
        }
        return text;
    }
    matches(keyEvent){
        const other = new KeyboardShortcut(keyEvent);
        if(!other.isValid) return;

        if(
            other.hasShift == this.hasShift
            && other.hasAlt == this.hasAlt
            && other.hasControl == this.hasControl
            && other.keyName == this.keyName
            ){
                return true;
            }
        return false;
    }
}

const convertFromDb = async fromDb => {
    const shortcutAndCommand = JSON.parse(fromDb.json);
    const commandApi = await import("../command/command.js");
    const commandType = shortcutAndCommand.command;
    let args = null;
    if(commandType == "CommandCustom"){        
        const {SettingCustomActions} = await import("../settings/setting.js")
        const customActions = await (new SettingCustomActions({}).value);
        const customAction = await customActions.getCustomAction(shortcutAndCommand.id)
        if(!customAction){
            return {
                shortcut:new KeyboardShortcut(shortcutAndCommand.shortcut)
            };
        }else{
            args = customAction.commandArgs;
        }
    }
    return {
        command:new commandApi[shortcutAndCommand.command](args),
        shortcut:new KeyboardShortcut(shortcutAndCommand.shortcut)
    }
}
export class DBKeyboardShortcut{
    constructor(db){
        this.db = db;
    }
    async updateSingle(shortcutAndCommand){
        const key = shortcutAndCommand.shortcut.toString();
        shortcutAndCommand.id = shortcutAndCommand.command.id;
        shortcutAndCommand.command = shortcutAndCommand.command.constructor.name;
        await this.db.shortcuts.put({key,json:JSON.stringify(shortcutAndCommand)});
    }
    async removeSingle(shortcut){
        const key = shortcut.toString();
        await this.db.shortcuts.delete(key);
    }
    async removeSingleByCommand(command){
        if(!command) return;

        const all = await this.getAll();
        const toRemove = all.find(shortcutAndCommand => shortcutAndCommand.command.matches(command));
        if(!toRemove) return;

        return await this.removeSingle(toRemove.shortcut);
    }
    async getAll(){
        const array = await this.db.shortcuts.toArray();
        const shortcutsAndcommands = await Promise.all(array.map(convertFromDb));
        const empty = shortcutsAndcommands.filter(shortcutAndCommand=>!shortcutAndCommand.command);
        await Promise.all(empty.map(toRemove=>this.removeSingle(toRemove.shortcut)));
        return shortcutsAndcommands.filter(shortcutAndCommand=>shortcutAndCommand.command);;
    }
    async getCommand(shortcut){
        if(!Util.isType(shortcut,"KeyboardShortcut")){
            shortcut = new KeyboardShortcut(shortcut);
        }
        const fromDb = await this.db.shortcuts.get(shortcut.toString());
        const shortcutAndCommand = await convertFromDb(fromDb);
        if(!shortcutAndCommand.command){
            await this.removeSingle(shortcutAndCommand.shortcut);
            return null;
        }
        return shortcutAndCommand.command;
    }
}