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
        this.event = {
            shiftKey:keyEvent.shiftKey,
            ctrlKey:keyEvent.ctrlKey,
            altKey:keyEvent.altKey,
            keyCode:keyEvent.keyCode,
            code:keyEvent.code,
        };
    }
    get hasShift(){
        return this.event.shiftKey;
    }
    get hasControl(){
        return this.event.ctrlKey;
    }
    get hasAlt(){
        return this.event.altKey;
    }
    get isShift(){
        return this.event.keyCode == 16;
    }
    get isControl(){
        return this.event.keyCode == 17;
    }
    get isAlt(){
        return this.event.keyCode == 18;
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
            text += this.event.code.replace("Key","")
        }
        return text;
    }
}