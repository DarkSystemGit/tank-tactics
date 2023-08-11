const colorConvert = require('convert-css-color-name-to-hex')
const fs = require('fs')
const path = require('path')
//sheet name is gsheet.json
var sheet = JSON.parse(fs.readFileSync(path.join(__dirname,'gsheet.json')))
//board size
var size = 20
//db template
var database = {
    "tanks":[],
    "votes": {},
    "boardSize": size,
    "gameDayMillis": 86400000,
    "gameStartedDatetimeMillis": Date.now()
}
var playerPos = [[Math.round(Math.random() * (size-0)+0),Math.round(Math.random() * (size-0)+0)]]
sheet.forEach((element) => {
    function generateCords(){
        var cords = [Math.round(Math.random() * (size-0)+0),Math.round(Math.random() * (size-0)+0)];
        for(var i =0;i<playerPos.length;i++){
            if (cords == playerPos[i]){
                cords = [Math.round(Math.random() * (size-0)+0),Math.round(Math.random() * (size-0)+0)];
            }else{
                playerPos.push(cords);
                return cords;
            };
        };
    };
    var color = colorConvert(element.color.toLowerCase())
    
    database.tanks.push([element.username, element.password,color,generateCords(),3,2,2,element.name])

});


fs.writeFileSync(path.join(__dirname,'db.json'),JSON.stringify(database))
fs.writeFileSync(path.join(__dirname,'db_initial.json'),JSON.stringify(database))
