export class AutoAppsCommand {
    constructor(message, variables, options){
        this.message = message;
        this.variables = variables;
        this.parseNumbers = options ? options.parseNumbers : false;
        this.payload = this.getPayload();
        this.command = this.payload["command"] ? this.payload.command : this.payload;
        this.values = this.getValues();
    }
    getValues(){
    	var values = [];
    	if(this.message.indexOf("=:=")<0) return values;
        var commandParts = this.message.split("=:=");
        if(commandParts.length<2) return values;
        commandParts.shift();
        for(var commandPart of commandParts){
            commandPart = this.parseNumberIfCan(commandPart);
        	values.push(commandPart);
        }
        return values;
    }
    getPayload(){
        var payload = this.message;
        var getCommandPayload = () => ({"command":payload});
        if(typeof this.variables == "string"){
                this.variables = this.variables.split(",");
        }
        if(!this.variables || this.variables.length == 0 || this.message.indexOf("=:=")<0){
            return getCommandPayload();
        }
        var commandParts = this.message.split("=:=");
        if(commandParts.length == 0){
            return getCommandPayload();
        }
        payload = {"command":commandParts[0]};
        this.values = [];
        for (var i = 0; i < this.variables.length && i < commandParts.length- 1 ; i++) {
            var variable = this.variables[i];

            var commandPart = commandParts[i+1];
            if(!commandPart) continue;
			
			this.values.push(commandPart);
            commandPart = this.parseNumberIfCan(commandPart);
            payload[variable] = commandPart;
        }
        return payload;
    }
    isMatch(configuredCommand){
        return this.command == configuredCommand;
    }
    parseNumberIfCan(numberString){
        if(!this.parseNumbers) return numberString;

        var number = parseInt(numberString);
        if(isNaN(number)) return numberString;

        numberString = number;
        return numberString;
    }
}