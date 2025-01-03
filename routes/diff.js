router.get(/^\/diff\/(.*)/, async (req, res) => {
	const title  = req.params[0];
	const doc    = processTitle(title);
	const rev    = req.query['rev'];
	const oldrev = req.query['oldrev'];
	
	var aclmsg = await getacl(req, doc.title, doc.namespace, 'read', 1);
	if(aclmsg) return res.status(403).send(await showError(req, { code: 'permission_read', msg: aclmsg }));
	if(!rev || !oldrev || Number(rev) <= Number(oldrev)) return res.send(await showError(req, 'revision_not_found'));
	var dbdata = await curs.execute("select content, secret from history where title = ? and namespace = ? and rev = ?", [doc.title, doc.namespace, rev]);
	if(!dbdata.length) return res.send(await showError(req, 'revision_not_found'));
	const revdata = dbdata[0];
	if(rev && revdata.secret) return res.send(await showError(req, 'secret_rev'));
	var dbdata = await curs.execute("select content, secret from history where title = ? and namespace = ? and rev = ?", [doc.title, doc.namespace, oldrev]);
	if(!dbdata.length) return res.send(await showError(req, 'revision_not_found'));
	const oldrevdata = dbdata[0];
	if(oldrev && oldrevdata.secret) return res.send(await showError(req, 'secret_rev'));
	const diffoutput = diff(oldrevdata.content, revdata.content, 'r' + oldrev, 'r' + rev);
	var content = diffoutput;
	
	res.send(await render(req, doc + ' (비교)', content, {
		rev,
		oldrev,
		diffoutput,
		document: doc,
	}, _, null, 'diff'));
});