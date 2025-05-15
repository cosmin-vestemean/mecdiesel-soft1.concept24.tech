--Cod specific S1 - SQL - API
select a.findoc, 
b.fincode document, 
a.data_mesaj, a.mesaj,
c.name utilizator
from CCCCONVERSIEAUTOMESSAGERIE a 
left join findoc b on (a.findoc=b.findoc)
left join users c on (a.usr=c.users)
order by a.data_mesaj desc, a.findoc, a.CCCCONVERSIEAUTOMESSAGERIE desc
offset {skip_rows} rows fetch next {fetch_next_rows} rows only