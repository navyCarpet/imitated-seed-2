const sqlite3 = require('sqlite3').verbose();
const inputReader = require('wait-console-input');
const conn = new sqlite3.Database('./wikidata.db', () => 1);

function Split(str, del) { return str.split(del); }; const split = Split;
function UCase(s) { return s.toUpperCase(); }; const ucase = UCase;
function LCase(s) { return s.toUpperCase(); }; const lcase = LCase;

function print(x) { console.log(x); }
function prt(x) { process.stdout.write(x); }
function input(prpt) {
	prt(prpt);
	return inputReader.readLine('');
}

conn.commit = function() {};
conn.sd = [];

const curs = {
	execute: function executeSQL(sql = '', params = []) {
		return new Promise((resolve, reject) => {
			if(UCase(sql).startsWith("SELECT")) {
				conn.all(sql, params, (err, retval) => {
					if(err) return reject(err);
					conn.sd = retval;
					resolve(retval);
				});
			} else {
				conn.run(sql, params, err => {
					if(err) return reject(err);
					resolve(0);
				});
			}
		});
	},
	fetchall: function fetchSQLData() {
		return conn.sd;
	},
};

async function removeHistory(title, rev) {
    const doc = processTitle(title);
    const total = (await curs.execute("select count(rev) from history where title = ? and namespace = ?", [doc.title, doc.namespace]))[0]['count(rev)'];
    if (Number(rev) === total) {
        if (rev === '1') {
            await curs.execute("delete from documents where title = ? and namespace = ?", [doc.title, doc.namespace]);
        }
        else {
            var dbdata = await curs.execute("select * from history where title = ? and namespace = ? order by cast(rev as integer) desc limit 2", [doc.title, doc.namespace]);
            await curs.execute("delete from documents where title = ? and namespace = ?", [doc.title, doc.namespace]);
            if (dbdata.length === 2) {
                await curs.execute("insert into documents (content, title, namespace) values (?, ?, ?)", [dbdata[1].content, doc.title, doc.namespace]);
            }
        }
    }
    
    await curs.execute("delete from history where title = ? and namespace = ? and rev = ?", [doc.title, doc.namespace, rev]);
}

var title = input('문서 title: ');
var rev = input('리비전: ');

removeHistory(title, rev);