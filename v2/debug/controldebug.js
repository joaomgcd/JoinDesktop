import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";

export class ControlDebug extends Control{
    constructor(){
        super();
        const errorHandler = (e) => {
            console.error("Caught unexpected error", e);
            var message = e;
            if(!Util.isString(e)){
                message = e.message;
            }
            message = `Unexpected Error: ${message}`;
            if(e.filename){
                message = `${message} in file ${e.filename}`;
            }
            if(e.lineno){
                message = `${message} at line ${e.lineno}`;
            }
            if(e.stack){
                message = `${message}<br/><br/>Trace:<br/>${Util.replaceAll(e.stack,"\n","<br/>")}`;
            }

			this.debug(message,true);
		}
        window.onerror = errorHandler;
		window.onunhandledrejection = errorPromise=>errorPromise.promise.catch(errorHandler);
    }
    debug(message,isError){
        console.log(message);
        const showAllDebugs = window.location.href.indexOf("debug")>0;
        if(!showAllDebugs && !isError) return;

        this.debugTextElement.innerHTML = message;
        UtilDOM.show(this.debugTextElement);
    }    
    getHtml(){
        return `<div id="debug" class="hidden"></div>`;
    }
    // getHtmlFile(){
    //     return "./v2/debug/debug.html";
    // }
    
    async renderSpecific({root}){
        this.debugTextElement = root;

        return root;
    }
}