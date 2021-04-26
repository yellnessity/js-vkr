#include <iostream>
#include <napi.h>
#include <wels/codec_api.h>

class Decoder: public Napi::ObjectWrap<Decoder>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    Decoder(const Napi::CallbackInfo& info);
    ~Decoder();

private:
    Napi::Value Decode(const Napi::CallbackInfo& info);

    //decoder declaration
    ISVCDecoder* pSvcDecoder;
    //in-out: for Decoding only: declare and initialize the output buffer info, this should never co-exist with Parsing only
    SBufferInfo sDstBufInfo;
    //in-out: for Parsing only: declare and initialize the output bitstream buffer info for parse only, this should never co-exist with Decoding only
    // SParserBsInfo sDstParseInfo;
    SDecodingParam sDecParam = {};
    unsigned char* pData[3];
};

Napi::Object Decoder::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env,
        "Decoder",
        {
            InstanceMethod("decode", &Decoder::Decode)
        }
    );

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("Decoder", func);

    return exports;
}

Decoder::Decoder(const Napi::CallbackInfo& info): Napi::ObjectWrap<Decoder>(info)
{
    std::cerr << "Decoder beg" << std::endl;

    Napi::Env env = info.Env();

    memset(&this->sDstBufInfo, 0, sizeof(SBufferInfo));
    // memset(&this->sDstParseInfo, 0, sizeof(SParserBsInfo));
    //In Parsing only, allocate enough buffer to save transcoded bitstream for a frame
    // this->sDstParseInfo.pDstBuff = new unsigned char[64 * 1024];
    long res = WelsCreateDecoder(&this->pSvcDecoder);
    if (res)
    {
        throw Napi::Error::New(env, "WelsCreateDecoder");
    }

    this->sDecParam.sVideoProperty.eVideoBsType = VIDEO_BITSTREAM_AVC;
    // for Parsing only, the assignment is mandatory
    this->sDecParam.bParseOnly = false;

    res = this->pSvcDecoder->Initialize(&this->sDecParam);
    if (res)
    {
        WelsDestroyDecoder(this->pSvcDecoder);

        throw Napi::Error::New(env, "pSvcDecoder->Initialize");
    }

    std::size_t pDataLength = 1 * 3840 * 2160;
    // this->pData = new unsigned char*[3];
    // for (int i = 0; i < 3; ++i)
    //     this->pData[i] = new unsigned char[pDataLength];

    std::cerr << "Decoder end" << std::endl;
}

Decoder::~Decoder()
{
    std::cerr << "~Decoder beg" << std::endl;

    // uninitialize the decoder and memory free
    this->pSvcDecoder->Uninitialize();
    std::cerr << "~Decoder Uninitialize" << std::endl;

    // destroy the decoder
    WelsDestroyDecoder(this->pSvcDecoder);
    // delete[] this->sDstParseInfo.pDstBuff;
    std::cerr << "~Decoder WelsDestroyDecoder" << std::endl;

    for (int i = 0; i < 3; ++i)
        delete[] this->pData[i];
    // delete[] this->pData;

    std::cerr << "~Decoder end" << std::endl;
}

Napi::Value Decoder::Decode(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();

    if (info.Length() <= 0)
    {
        throw Napi::Error::New(env, "Wrong number of arguments");
    }

    if (!info[0].IsBuffer())
    {
        throw Napi::Error::New(env, "Wrong arguments");
    }

    int iRet;

    // input: encoded bitstream start position; should include start code prefix
    unsigned char* pBuf = info[0].As<Napi::Buffer<unsigned char>>().Data();
    // input: encoded bit stream length; should include the size of start code prefix
    std::size_t iSize = info[0].As<Napi::Buffer<unsigned char>>().Length();
    // output: [0~2] for Y,U,V buffer for Decoding only

    // for Decoding only
    iRet = pSvcDecoder->DecodeFrameNoDelay(pBuf, iSize, this->pData, &sDstBufInfo);
    // std::cout << "iRet: " << iRet << std::endl;

    // decode failed
    if (iRet != 0)
    {
        //error handling (RequestIDR or something like that)
        std::cout << "H264 decoding failed. Error code: " << iRet << "." << std::endl;
        throw Napi::Error::New(env, "DecodeFrameNoDelay");
    }

    // for Decoding only, pData can be used for render.
    if (sDstBufInfo.iBufferStatus == 1)
    {
        int w = sDstBufInfo.UsrData.sSystemBuffer.iWidth;
        int h = sDstBufInfo.UsrData.sSystemBuffer.iHeight;
        int s_0 = sDstBufInfo.UsrData.sSystemBuffer.iStride[0];
        // int s_1 = sDstBufInfo.UsrData.sSystemBuffer.iStride[1];

        auto data = Napi::Buffer<unsigned char>::New(env, w * h);
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("width", w);
        obj.Set("height", h);
        obj.Set("data", data);

        for (int y = 0; y < h; ++y)
        {
            std::memcpy(data.Data() + y * w, sDstBufInfo.pDst[0] + y * s_0, w);

            // for (int x = 0; x < w; ++x)
            // {
            //     data.Data()[x + y * w] = sDstBufInfo.pDst[0][x + y * s_0];
            // }
        }

        return obj;
    }

    return env.Null();
}

static Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return Decoder::Init(env, exports);
}

NODE_API_MODULE(addon, Init)
