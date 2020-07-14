import { ControlDialogOk } from "../dialog/controldialog.js";
import { DialogOk } from "../dialog/dialog.js";
import { EventBus } from "../eventbus.js";

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
            e.stopPropagation();
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
            e.stopPropagation();
            enableDisableButton();
        }
        window.addEventListener("keydown",keyListenerDown,true);
        window.addEventListener("keyup",keyListenerUp,true);
        const okOrCancel =  [EventBus.waitFor("ButtonOk",9999999999),EventBus.waitFor("ButtonCancel",9999999999)];
        const button = await Promise.race(okOrCancel);
        if(Util.isType(button,"ButtonCancel")){
            current = null;
            EventBus.post({},"ButtonOk");
        }else{
            EventBus.post({},"ButtonCancel");
        }
        window.removeEventListener("keydown",keyListenerDown);
        window.removeEventListener("keyup",keyListenerUp);
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
}

const convertFromDb = async fromDb => {
    const shortcutAndCommand = JSON.parse(fromDb.json);
    const commandApi = await import("../command/command.js");
    return {
        command:new commandApi[shortcutAndCommand.command](),
        shortcut:new KeyboardShortcut(shortcutAndCommand.shortcut)
    }
}
export class DBKeyboardShortcut{
    constructor(db){
        this.db = db;
    }
    async updateSingle(shortcutAndCommand){
        const key = shortcutAndCommand.shortcut.toString();
        shortcutAndCommand.command = shortcutAndCommand.command.constructor.name;
        await this.db.shortcuts.put({key,json:JSON.stringify(shortcutAndCommand)});
    }
    async getAll(){
        const commandApi = await import("../command/command.js")
        const array = await this.db.shortcuts.toArray();
        const shortcutsAndcommands = Promise.all(array.map(convertFromDb));
        return shortcutsAndcommands;
    }
    async getCommand(shortcut){
        const fromDb = await this.db.shortcuts.get(shortcut.toString());
        const shortcutAndCommand = await convertFromDb(fromDb);
        return shortcutAndCommand.command;
    }
}