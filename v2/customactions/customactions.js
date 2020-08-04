import { EventBus } from "../eventbus.js";

export class CustomActions extends Array{	
	constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!initial || !initial.map) return;

		initial.forEach(customAction=>this.push(new CustomAction(customAction)));
    }
    update(customAction){
        const existing = this.getCustomAction(customAction.id);
        if(existing){
            Object.assign(existing,customAction);
        }else{
            this.push(new CustomAction(customAction));
        }
    }
    delete(customAction){
        if(Util.isString(customAction)){
            customAction = this.getCustomAction(customAction);
        }
        if(!customAction) return;

        Util.removeIf(this,existing=>existing.id == customAction.id);
    }
    /**
     * 
     * @param {String} id 
     * @returns {CustomAction}
     */
    getCustomAction(id){
        if(!id) return null;

        return this.find(existing => existing.id == id);
    }
}
export class CustomAction{
	constructor(args= { id, icon, name, longName, command, parameters, deviceIds, commandLine, commandResponse }){
        Object.assign(this,args);
        if(!args.parameters){
            args.parameters = [];
        }
        this.parameters = new CustomActionParameters(args.parameters);
    }
    deleteParameter(parameter){
        Util.removeIf(this.parameters,existing=>existing.id == parameter.id);
    }
    async execute(device){
        const {text,args,command} = await this.commandToExecute;
        const commandLine = this.commandLine;
        const commandName = this.name;
        const commandResponse = this.commandResponse;
        console.log("Executing custom action",{text,args,command},device);
        // if(this.commandLine){
        //     await EventBus.post(new RequestRunCommandLineCommand({command,args}));
        //     return;
        // }
        await device.sendPush({text,commandLine,commandName,commandResponse});
    }
    /**
     * 
     * @param {String} text 
     */
    static getCommandToExecuteFromCommandText(text){
        let command = text;
        let args = [];
        const result = () =>{
            return {command,args,text};
        }
        if(!text) return result();
        if(!text.includes("=:=")) return result();
        const split = text.split("=:=").filter(part=>part ? true : false);

        command = split[0];
        if(split.length == 1) return result();

        for (let index = 1; index < split.length; index++) {
            const element = split[index];
            args.push(element);
        }
        return result();
    }
    get commandToExecute(){
        const command = this.command;
        let text = command;
        if(!text) return null;

        let args = [];
        return (async () => {
            for(const parameter of this.parameters){
                const parameterPrompt = parameter.text;
                if(!parameterPrompt) continue;
                
                const {ControlDialogInput} = await import("../dialog/controldialog.js");
                const result = await ControlDialogInput.showAndWait({title:this.name,placeholder:parameterPrompt});
                if(!result) return;

                args.push(result);
                text = `${text}=:=${result}`;
            }
            return {text,args,command};
        })()
    }
    get needsInputs(){
        const paramWithText = this.parameters.find(parameter => parameter.text);
        return paramWithText ? true : false;
    }
    get commandArgs(){
        const idFromArgs = this.id;
        const text = this.name;
        const iconFromArgs = this.icon;
        const textExtendedGetter = device => this.longName || this.name
        const shouldEnableFromArgs = device => this.deviceIds && this.deviceIds.includes(device.deviceId);
        const needsFocusFromArgs = this.needsInputs;
        return {idFromArgs,text,textExtendedGetter,iconFromArgs,shouldEnableFromArgs,needsFocusFromArgs};
    }

}
export class CustomActionParameters extends Array{
	constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        if(!initial || !initial.map) return;

		initial.forEach(item=>this.push(new CustomActionParameter(item)));
    }
}
export class CustomActionParameter{
	constructor(args={ id, text }){
        if(!args.id){
            args.id = Util.uuid;
        }
        Object.assign(this,args);
    }

}