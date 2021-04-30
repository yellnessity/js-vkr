const WebSocket = require("ws");
const fs = require('fs');
const dgram = require('dgram');

const ws = new WebSocket('ws://localhost:5050/');
const client = dgram.createSocket("udp4");

let session;
let fileStream;
let counter = 0;
let tmpArray = [];

function is_one_3bytes(buf, pos)
{
    if ((buf[pos] == 0)
        && (buf[pos + 1] == 0)
        && (buf[pos + 2] == 1))
    {
        return true;
    }

    return false;
}

function is_one_4bytes(buf, pos)
{
    if ((buf[pos] == 0)
        && (buf[pos + 1] == 0)
        && (buf[pos + 2] == 0)
        && (buf[pos + 3] == 1))
    {
        return true;
    }

    return false;
}

function numPadding(num, paddingSize, value = ' ', radix = 10)
{
    let s = num.toString(radix);

    while (s.length < paddingSize)
    {
        s = value + s;
    }

    return s;
}

function start_code_prefix_one_3bytes(buf, pos)
{
    if (!is_one_3bytes(buf, pos))
    {
        throw new Error('start_code_prefix_one_3bytes');
    }

    return pos + 3;
}

function nal_unit(buf, pos)
{
    let header = buf[pos];
    let obj = {
        forbidden_zero_bit: (header & 0x80) >> 7,
        nal_ref_idc: (header & 0x60) >> 5,
        nal_unit_type: (header & 0x1F)
    };
    if (obj.nal_unit_type === 5) console.log(
        '0x' + numPadding(pos, 8, '0', 16),
        '0x' + numPadding(header, 2, '0', 16),
        obj,
    );
    ++pos;

    return pos;
}

function byte_stream_nal_unit(buf, pos)
{
    if (pos >= buf.length)
    {
        return pos;
    }

    while (!is_one_3bytes(buf, pos)
        && !is_one_4bytes(buf, pos))
    {
        ++pos;
        if (pos >= buf.length) return pos;
    }

    let start = pos;

    if (!is_one_3bytes(buf, pos))
    {
        ++pos;
    }

    pos = start_code_prefix_one_3bytes(buf, pos);
    pos = nal_unit(buf, pos);

    while (!is_one_3bytes(buf, pos)
        && !is_one_4bytes(buf, pos)
        && pos < buf.length)
    {
        ++pos;
    }

    let finish = pos;
    let target = Buffer.alloc(finish - start + 8);
    target.writeInt32BE(counter, 0);
    target.write(session, 4, 4, 'hex');
    buf.copy(target, 8, start, finish);

    // вывести target проверить запись порядка фрейма
    // client.send(target, 0, target.length, 41234, "0.0.0.0", function(
    //     err,
    //     bytes
    // )
    // {
    //     if (err) throw err;
    // });
    tmpArray.push(target);
    return pos;
}

ws.on('open', function open()
{
    ws.send('start');
});

ws.on('message', function incoming(data)
{
    if (data === 'got face' && session)
    {
        session = null;
        counter = 0;
        console.log('face recognized');
    }
    else
    {
        session = data;
        let buf = null;

        fileStream = fs.createReadStream('video.mp4');
        fileStream.on('data', function(chunk)
        {
            let pos = 0;
            while (pos < chunk.length)
            {
                if (!session)
                {
                    fileStream.destroy();
                    return;
                }

                pos = byte_stream_nal_unit(chunk, pos);

                counter++;
            }
        });
        fileStream.on('end', function()
        {
            if (tmpArray.length > 0)
            {
                for (let i = tmpArray.length - 1; i > 0; i--)
                {
                    let j = Math.floor(Math.random() * (i + 1));
                    [tmpArray[i], tmpArray[j]] = [tmpArray[j], tmpArray[i]];
                }
                for (let i = 0; i < tmpArray.length; i++) {
                    if (i < 2) console.log(tmpArray[i]);
                    client.send(tmpArray[i], 0, tmpArray[i].length, 41234, "0.0.0.0", function(
                        err,
                        bytes
                    )
                    {
                        if (err) throw err;
                    });
                }

            }
        });
    }
});
