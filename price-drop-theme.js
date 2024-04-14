
document.addEventListener("DOMContentLoaded", (event) => {
    // Function to calculate time difference between two dates
    function getTimeDifference(currentTime, updateTime) {
        return Math.floor((updateTime - currentTime) / 1000); // Difference in seconds
    }

    // Function to format time as MM:SS
    function formatTime(minutes, seconds) {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Function to update the timer display
    function updateTimerDisplay(timeDiff) {
        var minutesLeft = Math.floor(timeDiff / 60);
        var secondsLeft = timeDiff % 60;

        var timerDisplay = formatTime(minutesLeft, secondsLeft);
        document.getElementById("product-update-timer").textContent = timerDisplay;
    }

    // Function to update the timer every second
    function updateTimer() {
        var lastUpdateTime = new Date("04/15/2024 01:11:40"); // Last update time
        var updateInterval = 5 * 60; // Update interval in seconds

        // Calculate next update time
        var nextUpdateTime = new Date(lastUpdateTime.getTime() + updateInterval * 1000);

        // Update the timer display immediately
        var currentTime = new Date();
        var timeDiff = getTimeDifference(currentTime, nextUpdateTime);
        updateTimerDisplay(timeDiff);

        // Update the timer display every second
        var intervalId = setInterval(function () {
            currentTime = new Date();
            timeDiff = getTimeDifference(currentTime, nextUpdateTime);
            updateTimerDisplay(timeDiff);

            // Clear the interval when the time difference becomes negative (i.e., after the next update time)
            if (timeDiff <= 0) {
                clearInterval(intervalId);
            }
        }, 1000);
    }

    // Call the function initially
    updateTimer();

});