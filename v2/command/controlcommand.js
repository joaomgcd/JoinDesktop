import { Control } from '../control.js';
import { Commands } from './command.js';
import { AppContext } from '../appcontext.js';
import { EventBus } from '../eventbus.js';
import { UtilDOM } from '../utildom.js';

export class ControlCommands extends Control {
    constructor(args){
        super();
        const commands = new Commands([],args);
        this.commandControls = commands.map(command=>new ControlCommand(command));
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
        this.commandControls.forEach(commandControl=>commandControl.updateEnabled(this.selectedControlDevice));
    }
    setLink({command,device,apiKey}){
        const controlCommand = this.commandControls.find(commandControl=>commandControl.command === command);
        controlCommand.link = command.getLink({device,apiKey});
    }
}
export class ControlCommand extends Control {
    constructor(command){
        super();
        this.command = command;
    }
    getHtml(){
        return `<div class="devicebutton" role="button">
            <div class="commandiconwrapper"></div>
            <a class='buttonlink' ></a>
            <a class='buttonlinkextended' ></a>
        </div>`;
    }
    async renderSpecific({root}){
        this.commandButton = root;
        this.commandTextElement = await this.$(".buttonlink");
        this.commandTextExtendedElement = await this.$(".buttonlinkextended");
        this.commandIconWrapperElement = await this.$(".commandiconwrapper");

        this.commandTextElement.innerHTML = this.command.getText();
        this.commandButton.setAttribute("aria-label",this.command.getText());

        UtilDOM.setInnerHTMLOrHide(this.commandIconWrapperElement,this.command.icon);

        return root;
    }
    get isEnabled(){
        return !this.commandButton.classList.contains("disabled");
    }
    updateEnabled(deviceControl){
        if(!this.commandButton) return;

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