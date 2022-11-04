require('dotenv').config()
const fs = require("fs");
const {PutObjectCommand,GetObjectCommand,S3Client} = require("@aws-sdk/client-s3");
const {TranscribeClient,StartTranscriptionJobCommand,ListTranscriptionJobsCommand} = require("@aws-sdk/client-transcribe");

//Add the required files in files directory
//Add all the info in .env file
// To Get the Transcribed Json file from the Bucket this is the code.
const  getObject = async() =>{
const params = {
        Bucket:process.env.BUCKET_NAME,
        Key:process.env.TRANSCRIBE_OUTPUT_KEY,
    }
 const s3client = new S3Client();

//  To Capture Stream Data and Convert it.
 const streamToString = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

// Call made to the s3 bucket to get the transcribed file.
try{
const data = await s3client.send(new GetObjectCommand(params))
const result = await streamToString(data.Body)

//Writing File to file System.
fs.writeFileSync(`./z_responses/${process.env.TRANSCRIBE_NAME}.json`,result)
return "completed Saving File To File System"
}catch(err){
    return err
}

}

// Put Object Command
const  putObject = async() => {
    const data = fs.readFileSync(process.env.LOCATION);
    const resource = {
        Bucket:process.env.BUCKET_NAME,
        Key:process.env.OBJECT_KEY,
        Body:data
    }
    const s3client = new S3Client();
    //Putting Audio Source to s3 bucket.
    const response = await s3client.send(new PutObjectCommand(resource));
    return response;
}

// To Check the status of the Transcription service.
async function checkPointer(){
    return await new Promise((resolve)=>{
        // To check the status after intervals.
        const timer = setInterval(async()=>{
            console.log("Checking")
            const resp = await checkStatusOfTranscribe()
            console.log(resp);
            if(resp=="COMPLETED"){
                resolve("Job Completed")
                clearInterval(timer)
            }
        },4000)
    })
    
}

// To Create a trancription job.
const createTranscriptionJob = async()=>{
    const transcribeClient = new TranscribeClient()
    const params = {
        TranscriptionJobName: process.env.TRANSCRIBE_NAME,
        LanguageCode: "en-US", // For example, 'en-US'
        MediaFormat: "mp3", // For example, 'wav'
        Media: {
            MediaFileUri: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${process.env.OBJECT_KEY}`
            // For example, "https://transcribe-demo.s3-REGION.amazonaws.com/hello_world.wav"
        },
        OutputKey:process.env.TRANSCRIBE_OUTPUT_KEY,
        OutputBucketName: process.env.BUCKET_NAME
    };
    // Query to start the transcription service.
    const response = await transcribeClient.send(new StartTranscriptionJobCommand(params));
      return response;
}

// To check status of Transcribe Jobs.
const checkStatusOfTranscribe = async()=>{
    let completionStatus = false
    const params = {
        JobNameContains:process.env.TRANSCRIBE_NAME
    }
    const transcribeClient = new TranscribeClient()
    //Query to list all transcribe services with params.
    const status = await transcribeClient.send(new ListTranscriptionJobsCommand(params))
    status.TranscriptionJobSummaries.filter((e)=>{
        if(e.TranscriptionJobName==process.env.TRANSCRIBE_NAME){
            completionStatus = e.TranscriptionJobStatus
            }
        })
    return completionStatus       
}

(
    async()=>{
        try{
            const resp = await putObject()
            console.log(resp)
        }catch(err){
            console.log(err)
            return
        }try{
            const resp = await createTranscriptionJob()
            console.log(resp)
        }catch(err){
            console.log(err)
            return
        }
        let resp = await checkPointer()
        console.log(resp)
        const getResp = await getObject()
        console.log(getResp)
    }
)()