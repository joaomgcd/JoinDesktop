export class Logs extends Array{
    constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
        }
        super();
        if(!initial){
            initial = [];
        }
        initial.forEach(logRaw=>{
            const log = new Log(logRaw);
            this.push(log);
        });
    }
    
}
export class Log{    
    constructor(logRaw = {title,text,date}){
        Object.assign(this,logRaw);
        if(!this.date){
            this.date = new Date().getTime().formatDate({full:true});
        }
    }
}