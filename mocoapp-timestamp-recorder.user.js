// ==UserScript==
// @name         mocoapp timestamp recorder
// @namespace    http://tampermonkey.net/
// @version      2025-09-03
// @description  try to take over the world!
// @author       You
// @match        https://*.mocoapp.com/activities
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mocoapp.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    waitForElement('table.tst-activities').then((table) => {
        initTable(table);
        initBehaviour();
        loadStoredTimeEntries();
    });

})();

function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function initTable(table) {

    const dayView = document.createElement('table');
    dayView.id = 'day-view-table';
    dayView.className = 'table'
    table.parentNode.append(dayView)

    const tbody = document.createElement('tbody');
    dayView.appendChild(tbody);

    const startHour = 7;
    const endHour = 18;
    const intervalMinutes = 15;

    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minutes = 0; minutes < 60; minutes += intervalMinutes) {
            // Skip intervals beyond 18:00
            if (hour === endHour && minutes > 0) break;

            // Format time
            const hh = hour.toString().padStart(2, '0');
            const mm = minutes.toString().padStart(2, '0');
            const timeStr = `${hh}:${mm}`;
            const classSuffix = `${hh}${mm}`;

            // Create row
            const row = document.createElement('tr');
            row.className = `row-${classSuffix}`;

            // Time cell
            const timeCell = document.createElement('td');
            timeCell.textContent = timeStr;

            // Empty cell
            const emptyCell = document.createElement('td');

            // Append cells to row
            row.appendChild(timeCell);
            row.appendChild(emptyCell);

            // Append row to table
            tbody.appendChild(row);
        }
    }
}

function watchTbodyForNewRows(tbody, callback) {
    if (!tbody) {
        console.error('tbody element not found');
        return;
    }

    // Create a MutationObserver instance
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            // Check if nodes were added
            mutation.addedNodes.forEach(node => {
                // If the added node is a <tr>, call the callback
                if (node.nodeName === 'TR') {
                    callback(node);
                }
            });
        });
    });

    // Start observing the tbody for child list changes
    observer.observe(tbody, { childList: true });
}

function initBehaviour(){
    const startButton = document.querySelector('table.tst-activities td.action button.btn-success');
    startButton.innerHTML = 'Start'

    const activitiesTable = document.querySelector('table.tst-activities tbody')
    watchTbodyForNewRows(activitiesTable, (row) => rowAdded(row))

    const timerButton = document.querySelector('tr.activity-row i.timer.fa-circle.fa-red')
    timerButton?.addEventListener('click', (e) => {
        const activityRow = e.target.closest('tr.activity-row');
        const activityId = getActivityId(activityRow)
        recordStop(activityId)
    })
}

function recordStart(activityId){
    const key = 'timeEntries';
    const existing = JSON.parse(localStorage.getItem(key)) || [];
    const alreadyExists = existing.some(entry => entry.activityId === activityId);


    if (!alreadyExists) {
        const today = new Date().toISOString().split('T')[0];
        const event = {
            date: today,
            activityId: activityId,
            start: new Date().toISOString()
        };
        existing.push(event);
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

function recordStop(activityId){
    const key = 'timeEntries';
    const existing = JSON.parse(localStorage.getItem(key)) || [];

    // Find the index of the entry with the matching activityId
    const index = existing.findIndex(entry => entry.activityId === activityId && !entry.stop);

    if (index !== -1) {
        // Update the stop time
        existing[index].stop = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

function rowAdded(row) {

    const activityId = getActivityId(row)
    if (activityId > 0 ) {
        recordStart(activityId)
    }
}

function getActivityId(row){
    const classList = row.className;
    const match = classList.match(/activity-(\d+)/);
    if (match) {
        const activityId = match[1];
        return activityId
    }
    return 0
}


function loadStoredTimeEntries(){
    const key = 'timeEntries';
    const existing = JSON.parse(localStorage.getItem(key)) || [];

    const today = new Date().toISOString().split('T')[0];
    const todayEntries = existing.filter(entry => entry.date === today);


    todayEntries.forEach((entry) => {
        const descField = document.querySelector('tr.activity-'+entry.activityId+' td.third ')

        const desc = document.createElement('div')
        desc.className = 'flex flex-row'
        descField.appendChild(desc)

        const times = document.createElement('div')
        times.className = 'pr-4'
        desc.appendChild(times)

        const start = new Date(entry.start)
        times.innerHTML = 'Start: '+start.toLocaleTimeString() +"<br>"

        if(entry.stop){
            const stop = new Date(entry.stop)
            times.innerHTML += 'Stop: '+stop.toLocaleTimeString()

            const duration = document.createElement('div')
            duration.className = ''
            desc.appendChild(duration)
            duration.innerHTML = 'Duration: ' + getDuration(start, stop)
        }
    })
}

function getDuration(startDate, endDate) {
    // difference in ms
    let diffMs = endDate - startDate;

    if (diffMs < 0) diffMs = -diffMs; // handle negative durations

    // convert to minutes
    const diffMinutes = Math.floor(diffMs / 1000 / 60);

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    // format as HH:mm
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}