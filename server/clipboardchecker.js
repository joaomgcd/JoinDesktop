const { clipboard } = require('electron')

class ClipboardChecker{
    constructor(pollingTime,callback){
        this.pollingTime = pollingTime;
        this.callback = callback;
        this.lastText = clipboard.readText();
    }
    start(){
        if(this.interval) return;

        console.log("Start monitoring clipboard",this.pollingTime);
        this.interval = setInterval(()=>{
            if(!this.callback) return;
            
            const text = clipboard.readText();
            if(text == this.lastText) return;

            // console.log("Clipboard changed to ",text);
            this.lastText = text;
            this.callback(text);
        },this.pollingTime);
    }
    stop(){
        if(!this.interval) return;

        console.log("Stop monitoring clipboard");
        clearInterval(this.interval);
        this.interval = null;
    }
    setClipboardText(text){
        if(!text) return;

        this.lastText = text;
        clipboard.writeText(text);
        console.log("Set clipboard",text);
    }
    get(){
        return clipboard.readText();
    }
}
exports.ClipboardChecker = ClipboardChecker; 