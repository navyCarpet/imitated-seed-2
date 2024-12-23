router.get(/^\/history\/(.*)/, async function viewHistory(req, res) {
    var title = req.params[0];
    const doc = processTitle(title);
    title = totitle(doc.title, doc.namespace);

    var aclmsg = await getacl(req, doc.title, doc.namespace, 'read', 1);
    if (aclmsg) return res.status(403).send(await showError(req, { code: 'permission_read', msg: aclmsg }));

    var total = (await curs.execute("select count(rev) from history where title = ? and namespace = ?", [doc.title, doc.namespace]))[0]['count(rev)'];
    var data;
    const from = req.query['from'];
    const until = req.query['until'];
    if (from) {
        data = await curs.execute("select flags, rev, time, changes, log, iserq, erqnum, advance, ismember, username, edit_request_id, loghider, secret, troll from history \
						where title = ? and namespace = ? and (cast(rev as integer) <= ? AND cast(rev as integer) > ?) \
						order by cast(rev as integer) desc",
            [doc.title, doc.namespace, Number(from), Number(from) - 30]);
    } else if (until) {
        data = await curs.execute("select flags, rev, time, changes, log, iserq, erqnum, advance, ismember, username, edit_request_id, loghider, secret, troll from history \
						where title = ? and namespace = ? and (cast(rev as integer) >= ? AND cast(rev as integer) < ?) \
						order by cast(rev as integer) desc",
            [doc.title, doc.namespace, Number(until), Number(until) + 30]);
    } else {
        data = await curs.execute("select flags, rev, time, changes, log, iserq, erqnum, advance, ismember, username, edit_request_id, loghider, secret, troll from history \
						where title = ? and namespace = ? order by cast(rev as integer) desc limit 30",
            [doc.title, doc.namespace]);
    }
    if (!data.length) return res.send(await showError(req, 'document_not_found'));

    const navbtns = navbtn(total, data[data.length - 1].rev, data[0].rev, '/history/' + encodeURIComponent(title));
    var content = `
		${navbtns}
		<p>
			<button id="diffbtn" class="btn btn-secondary">선택 리비젼 비교</button>
		</p>

		<ul class="wiki-list">
	`;

    for (var row of data) {
        const erq = row.edit_request_id;
        if (erq && ver('4.16.0')) {
            var dbd = await curs.execute("select slug from edit_requests where id = ?", [erq]);
            if (dbd.length) erq = dbd[0].slug;
        }
        if (row.troll) content += `
            <li style="font-size: 7pt;">
                ${generateTime(toDate(row.time), timeFormat)} 

                <span>
                    (
                        <a rel=nofollow href="/raw/${encodeURIComponent(title)}?rev=${row.rev}" data-npjax="true">RAW</a> |
                        <a rel=nofollow href="/blame/${encodeURIComponent(title)}?rev=${row.rev}">Blame</a>
                        ${Number(row.rev) > 1 ? ' | <a rel=nofollow href="/diff/' + encodeURIComponent(title) + '?rev=' + row.rev + '&oldrev=' + String(Number(row.rev) - 1) + '">비교</a>' : ''}
                        ${hasperm(req, 'mark_troll_revision') ? ` | <a rel=nofollow href="/mark_troll_revision/${encodeURIComponent(title)}?rev=${row.rev}&revert=1">[A]반달표시 해제</a>` : ''}
                    )
                </span>

                ${row.advance != 'normal' ? `<i>(${edittype(row.advance, ...(row.flags.split('\n')))})</i>` : ''}

                <strong>r${row.rev}</strong> 

                (<span style="color: ${( Number(row.changes) > 0 ? 'green' : Number(row.changes) < 0 ? 'red' : 'gray' ) };">${row.changes}</span>)

                ${ip_pas(row.username, row.ismember)} [${row.troll} 사용자에 의해 반달로 표시됨]
            </li>`;
        else content += `
				<li>
					${generateTime(toDate(row.time), timeFormat)} 
		
					<span style="font-size: 8pt;">
						(
                            <a rel=nofollow href="/w/${encodeURIComponent(title)}?rev=${row.rev}">보기</a> |
							<a rel=nofollow href="/raw/${encodeURIComponent(title)}?rev=${row.rev}" data-npjax="true">RAW</a> |
							<a rel=nofollow href="/blame/${encodeURIComponent(title)}?rev=${row.rev}">Blame</a> |
							<a rel=nofollow href="/revert/${encodeURIComponent(title)}?rev=${row.advance == 'revert' ? Number(row.flags) : row.rev}">이 ${ver('4.13.0') ? '리비전으로' : '리비젼으로'} 되돌리기</a>
							${Number(row.rev) > 1 ? ' | <a rel=nofollow href="/diff/' + encodeURIComponent(title) + '?rev=' + row.rev + '&oldrev=' + String(Number(row.rev) - 1) + '">비교</a>' : ''}
                            ${hasperm(req, 'mark_troll_revision') ? ` | <a rel=nofollow href="/mark_troll_revision/${encodeURIComponent(title)}?rev=${row.rev}&revert=">[A]반달로 표시</a>` : ''}
							${hasperm(req, 'hide_document_history_log') && row.log ? ` | <a rel=nofollow href="/hide_document_history_log/${encodeURIComponent(title)}?rev=${row.rev}&revert=${row.loghider ? '1' : ''}">[A]편집요약 숨기기${row.loghider ? ' 해제' : ''}</a>` : ''}
							${hasperm(req, 'hide_revision') ? ` | <a rel=nofollow href="/hide_revision/${encodeURIComponent(title)}?rev=${row.rev}&revert=${row.secret ? '1' : ''}">[A]리비전 숨기기${row.secret ? ' 해제' : ''}</a>` : ''}
                        )
					</span>

					<input type="radio" name="oldrev" value="${row.rev}"><input type="radio" name="rev" value="${row.rev}">

					${row.advance != 'normal' ? `<i>(${edittype(row.advance, ...(row.flags.split('\n')))})</i>` : ''}
					
					<strong>r${row.rev}</strong> 
					
					(<span style="color: ${( Number(row.changes) > 0 ? 'green' : Number(row.changes) < 0 ? 'red' : 'gray' ) };">${row.changes}</span>)
					
					${row.edit_request_id ? '<i><a href="/edit_request/' + row.edit_request_id + '">(편집 요청)</a></i>' : ''} ${ip_pas(row.username, row.ismember)}
					
					(<span style="color: gray;">${row.loghider ? (row.loghider + '에 의해 편집 요약 숨겨짐') : row.log}</span>) ${hasperm(req, 'hide_document_history_log') && row.loghider ? `<div style="display:inline"><button onclick="$(this).parent().find('span').show();$(this).remove();">내용 보기</button><span style="display:none;">(${row.log})</span></div>` : ''}
				</li>
		`;
    }

    content += `
		</ul>
		
		${navbtns}
		
		<script>historyInit("${encodeURIComponent(title)}");</script>
	`;

    res.send(await render(req, totitle(doc.title, doc.namespace) + '의 역사', content, {
        document: doc,
    }, '', null, 'history'));
});

router.get(/^\/hide_document_history_log\/(.*)$/, async (req, res) => {
    if (!hasperm(req, 'hide_document_history_log')) return res.status(403).send(await showError(req, 'permission'));
    const title = req.params[0];
    const doc = processTitle(title);
    const rev = req.query.rev || 0;
    const revert = req.query.revert;
    const loghider = revert ? '' : ip_check(req);
    await curs.execute("update history set loghider = ? where title = ? and namespace = ? and rev = ?", [loghider, doc.title, doc.namespace, rev]);
    return res.redirect('/history/' + encodeURIComponent(title));
});

router.get(/^\/hide_revision\/(.*)$/, async (req, res) => {
    if (!hasperm(req, 'hide_revision')) return res.status(403).send(await showError(req, 'permission'));
    const title = req.params[0];
    const doc = processTitle(title);
    const rev = req.query.rev || 0;
    const revert = req.query.revert;
    const secret = revert ? '' : '1';
    await curs.execute("update history set secret = ? where title = ? and namespace = ? and rev = ?", [secret, doc.title, doc.namespace, rev]);
    return res.redirect('/history/' + encodeURIComponent(title));
});

router.get(/^\/mark_troll_revision\/(.*)$/, async (req, res) => {
    if (!hasperm(req, 'mark_troll_revision')) return res.status(403).send(await showError(req, 'permission'));
    const title = req.params[0];
    const doc = processTitle(title);
    const rev = req.query.rev || 0;
    const revert = req.query.revert;
    const loghider = revert ? '' : ip_check(req);
    await curs.execute("update history set troll = ? where title = ? and namespace = ? and rev = ?", [loghider, doc.title, doc.namespace, rev]);
    return res.redirect('/history/' + encodeURIComponent(title));
});