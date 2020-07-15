import { Control } from '../control.js';
import { Commands } from './command.js';
import { AppContext } from '../appcontext.js';
import { EventBus } from '../eventbus.js';
import { UtilDOM } from '../utildom.js';

export class ControlCommands extends Control {
    constructor(args = {hideBookmarklets,shortcutsAndCommands}){
        super();
        this.commands = new Commands([],args);
        this.shortcutsAndCommands = args.shortcutsAndCommands;
        this.onSelectedDevice = selectedDevice => {
            this.selectedControlDevice = selectedDevice.controlDevice;
            this.updateEnabled();
        }
        EventBus.registerSticky(this);
    }
    getHtml(){
        return `<div class='button-container'></div>`;
    }
    getStyleFile(){
        return "./v2/command/commands.css";
    }
    /*getSelectedDevice(){
        return AppContext.context.getSelectedDevice();
    }*/
    async renderSpecific({root}){
        root.innerHTML = "";
        this.commandControls = this.commands.map(command=>{
            const shortcutAndCommand = this.shortcutsAndCommands.find(shortcutAndCommand => shortcutAndCommand.command.matches(command));
            let shortcut = null;
            if(shortcutAndCommand){
                shortcut = shortcutAndCommand.shortcut;
            }
            return new ControlCommand(command,shortcut);
        });
        //const selectedDevice = this.getSelectedDevice();
        for(const commandControl of this.commandControls){
            const commandRender = await commandControl.render();
            commandRender.onclick = async e => {
                if(!commandControl.isEnabled){
                    console.log("Clicked disabled command",commandControl.command.getText());
                    return;
                }
                //console.log("Clicked command",commandControl.command.getText());
                await commandControl.command.execute(this.selectedControlDevice.device);
            }
            //commandControl.updateEnabled(selectedDevice);
            root.appendChild(commandRender);
        }
        this.updateEnabled();
        return root;
    }
    updateEnabled(){
        if(!this.commandControls) return;

        this.commandControls.forEach(commandControl=>commandControl.updateEnabled(this.selectedControlDevice));
    }
    setLink({command,device,apiKey}){
        const controlCommand = this.commandControls.find(commandControl=>commandControl.command === command);
        controlCommand.link = command.getLink({device,apiKey});
    }
}
export class ControlCommand extends Control {
    constructor(command,shortcut){
        super();
        this.command = command;
        this.shortcut = shortcut;
    }
    getHtml(){
        return `<div class="devicebutton" role="button">
            <div class="commandiconwrapper"></div>
            <a class='buttonlink' ></a>
            <a class='buttonlinkextended' ></a>
            <svg class="commandkeyboardshortcut" style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M4,5A2,2 0 0,0 2,7V17A2,2 0 0,0 4,19H20A2,2 0 0,0 22,17V7A2,2 0 0,0 20,5H4M4,7H20V17H4V7M5,8V10H7V8H5M8,8V10H10V8H8M11,8V10H13V8H11M14,8V10H16V8H14M17,8V10H19V8H17M5,11V13H7V11H5M8,11V13H10V11H8M11,11V13H13V11H11M14,11V13H16V11H14M17,11V13H19V11H17M8,14V16H16V14H8Z" /></svg>
            <div class="commandkeyboardshortcuttext"></div>
        </div>`;
    }
    async renderSpecific({root}){
        this.commandButton = root;
        this.commandTextElement = await this.$(".buttonlink");
        this.commandTextExtendedElement = await this.$(".buttonlinkextended");
        this.commandIconWrapperElement = await this.$(".commandiconwrapper");
        this.keyboardShortcutElement = await this.$(".commandkeyboardshortcut");
        this.keyboardShortcutTextElement = await this.$(".commandkeyboardshortcuttext");

        this.commandTextElement.innerHTML = this.command.getText();
        this.commandButton.setAttribute("aria-label",this.command.getText());

        UtilDOM.setInnerHTMLOrHide(this.commandIconWrapperElement,this.command.icon);
        UtilDOM.showOrHide(this.keyboardShortcutElement,this.command.supportsKeyboardShortcut);
        UtilDOM.addOrRemoveClass(this.keyboardShortcutElement,this.shortcut?true:false,"configured");
        const shortcutText = this.shortcut ? this.shortcut.toString() : null;
        UtilDOM.setInnerHTMLOrHide(this.keyboardShortcutTextElement,shortcutText);
        this.keyboardShortcutElement.onclick = async (e) => {
            e.stopPropagation();
            await EventBus.post(new KeyboardShortcutClicked(this.command));
        }

        return root;
    }
    get isEnabled(){
        return !this.commandButton.classList.contains("disabled");
    }
    updateEnabled(deviceControl){
        if(!this.commandButton || !deviceControl) return;

        const device = deviceControl.device;
        if(deviceControl && deviceControl.device && this.command.shouldEnable(deviceControl.device)){
            this.commandButton.classList.remove("disabled");
        }else{            
            this.commandButton.classList.add("disabled");
        }
        const extendedText = this.command.getTextExtended(device);
        this.commandTextExtendedElement.innerHTML = extendedText || this.command.getText();
    }
    set link(value){
        this.commandTextElement.href = value
    }
}
class KeyboardShortcutClicked{
    constructor(command){
        this.command = command;
    }
}