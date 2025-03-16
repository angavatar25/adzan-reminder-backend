const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "http://localhost:3001", // Adjust frontend URL
      methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb://localhost:27017/notification_system"

// MongoDB Connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Schedule Model
const ScheduleSchema = new mongoose.Schema({
  title: String,
  datetime: Date
});

const Schedule = mongoose.model("Schedule", ScheduleSchema);

// API to get all schedules
app.get("/schedules", async (req, res) => {
  // const schedules = await Schedule.find().sort({ datetime: 1 });
  const schedules = await Schedule.find().sort({ datetime: 1 });
  res.json(schedules);
});

// API to update schedule
app.put("/schedules/:id", async (req, res) => {
  const { title, datetime } = req.body;

  try {
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { title, datetime: new Date(datetime) },
      { new: true }
    )

    if (!updatedSchedule) return res.status(404).json({ message: "Schedule not found" });

    io.emit("scheduleUpdated", updatedSchedule);
    res.json(updatedSchedule);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/schedules/:id", async (req, res) => {
  try {
    const deletedSchedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!deletedSchedule) return res.status(404).json({ message: "Schedule not found" });

    io.emit("scheduleDeleted", req.params.id);
    res.json({ message: "Schedule deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})

// Function to check for upcoming schedules
const checkSchedules = async () => {
  const now = new Date();

  const startOfMinute = new Date(now.setSeconds(0, 0));
  const upcomingTime = new Date(now.getTime() + 3 * 60000);
  upcomingTime.setSeconds(0, 0);

  const startingNowSchedules = await Schedule.find({
    datetime: startOfMinute,
  });

  const upcomingSchedules = await Schedule.find({
    datetime: upcomingTime,
  });

  startingNowSchedules.forEach(schedule => {
    io.emit("scheduleStarted", schedule);
  });

  upcomingSchedules.forEach(schedule => {
    io.emit("upcomingSchedule", schedule);
  });
};

setInterval(checkSchedules, 55000);


io.on("connection", (socket) => {
    socket.on("addSchedule", async (data) => {
      const newSchedule = new Schedule({ title: data.title, datetime: new Date(data.datetime) });
      await newSchedule.save();
      io.emit("newSchedule", newSchedule);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
