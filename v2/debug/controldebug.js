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

        const body = `This happenened when I: _____

Error Details:
${message}`
        this.reportElement.href = `mailto:support@joaoapps.com?subject=${encodeURIComponent("[Join Desktop] Error")}&body=${encodeURIComponent(body)}`
        this.debugTextElement.innerHTML = message;
        UtilDOM.show(this.wrapperElement);
    }    
    getHtml(){
        return `
        <div id="debugwrapper" class="hidden">
            <div id="debug"></div>
            <a id="debugreportlink">Report</a>
            <div id="debugclose">Close X</div>
        </div>`;
    }
    getStyle(){
        return `
            #debugwrapper{
                display: flex;
            }
            #debug{
                flex-grow: 1;
            }
            #debugclose{
                cursor: pointer;
            }
        `;
    }
    async renderSpecific({root}){
        this.wrapperElement = root;
        this.debugTextElement = await this.$("#debug");
        this.debugCloseElement = await this.$("#debugclose");
        this.reportElement = await this.$("#debugreportlink");

        this.debugCloseElement.onclick = ()  => UtilDOM.hide(this.wrapperElement)
        return root;
    }
}