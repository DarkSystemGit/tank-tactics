const ws = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
let websrv = http.createServer((req, res) => {
    if (req.url == '/') { req.url = "/index.html" }
    if (!fs.existsSync('./client/' + path.posix.normalize(req.url))) {
        res.writeHead(404);
        res.end();
        return;
    }
    fs.createReadStream('./client/' + path.posix.normalize(req.url))
        .on("data", d => res.write(d))
        .on("end", _ => res.end());
});
websrv.listen(8080);

let wss = new ws.Server({
    port: 9090
});
let socks = [];
wss.on("connection", socket => {
    socket.on("message", async rawMsg => {
        let msg = JSON.parse(rawMsg);
        let db = JSON.parse(fs.readFileSync("server/db.json"));
        if (msg.type == "auth") {
            let userIdx = -1;
            for (let i = 0; i < db.tanks.length; i++) {
                if (db.tanks[i][0] == msg.data.split(':')[0] && db.tanks[i][1] == msg.data.split(':')[1]) {
                    userIdx = i;
                    break;
                }
            }
            if (userIdx >= 0) {
                socket.user = msg.data.split(':')[0];
                socks.push(socket);
                let message = {
                    data: {
                        tanks: db.tanks,
                        boardSize: db.boardSize,
                        myTankIdx: userIdx
                    },
                    type: "auth-good"
                };
                for (let i = 0; i < message.data.tanks.length; i++) {
                    message.data.tanks[i].splice(1, 1);
                }
                socket.send(JSON.stringify(message));
                return;
            }
            socket.send(JSON.stringify({
                type: "auth-bad",
                data: null
            }));
            return;
        } else if (msg.type == "spectate") {
            socks.push(socket);
            let message = {
                data: {
                    tanks: db.tanks,
                    boardSize: db.boardSize,
                    myTankIdx: null
                },
                type: "spectate-good"
            };
            for (let i = 0; i < message.data.tanks.length; i++) {
                message.data.tanks[i].splice(1, 1);
            }
            socket.send(JSON.stringify(message));
            return;
        } else if (msg.type == "update") {
            if (socket.user == undefined) { return; }
            update(socket.user, msg.data, socket);
        }
    });
});

function getUserIdx(user) {
    const db = JSON.parse(fs.readFileSync("server/db.json"));
    for (let i = 0; i < db.tanks.length; i++) {
        if (db.tanks[i][0] == user) {
            return i;
        }
    }
}

function getUser(user) {
    const db = JSON.parse(fs.readFileSync("server/db.json"));
    return db.tanks[getUserIdx(user)];
}

function getUserSock(user) {
    for (let i = 0; i < socks.length; i++) {
        if (socks[i].user == user) {
            return socks[i];
        }
    }
    return null;
}

function updateError(sock, action, message) {
    sock.send(JSON.stringify({
        type: "update-error",
        data: {
            action,
            message
        }
    }));
}

function getUserAt(x, y) {
    const db = JSON.parse(fs.readFileSync("server/db.json"));
    for (let i = 0; i < db.tanks.length; i++) {
        if (db.tanks[i][3][0] == x && db.tanks[i][3][1] == y) {
            return db.tanks[i];
        }
    }
    return null;
}

function sendUpdate(user, hp, ap, x, y, range) {
    let msg = JSON.stringify({
        type: "update",
        data: {
            user,
            x,
            y,
            hp,
            ap,
            range
        }
    });
    socks.forEach(s => s.send(msg));

    let db = JSON.parse(fs.readFileSync("server/db.json"));
    let uidx = getUserIdx(user);
    db.tanks[uidx][3][0] = x;
    db.tanks[uidx][3][1] = y;
    db.tanks[uidx][4] = hp;
    db.tanks[uidx][5] = ap;
    db.tanks[uidx][6] = range;
    fs.writeFileSync("server/db.json", JSON.stringify(db));
}

function update(username, update, sock) {
    const db = JSON.parse(fs.readFileSync("server/db.json"));
    const user = getUser(username);
    if (update.type == "move") {
        const { dir, amount } = update;

        if (user[5] < amount) { updateError(sock, "moving", "You do not have enough AP move that far."); return; }

        if (dir == 0 && (user[3][1] - amount) < 0) { updateError(sock, "moving", "You can not go outside of the map."); return; }
        if (dir == 1 && (user[3][0] + amount) >= db.boardSize) { updateError(sock, "moving", "You can not go outside of the map."); return; }
        if (dir == 2 && (user[3][1] + amount) >= db.boardSize) { updateError(sock, "moving", "You can not go outside of the map."); return; }
        if (dir == 3 && (user[3][0] - amount) < 0) { updateError(sock, "moving", "You can not go outside of the map."); return; }

        let [x, y] = user[3];
        let [xoff, yoff] = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
        ][dir];
        for (let i = 0; i < amount; i++) {
            x += xoff;
            y += yoff;
            if (getUserAt(x, y) != null) { updateError(sock, "moving", "You can't move through other players."); return; }
        }

        sendUpdate(username, user[4], user[5] - amount, x, y, user[6]);
    }
}