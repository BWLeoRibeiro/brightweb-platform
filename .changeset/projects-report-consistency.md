---
"@brightweblabs/module-projects": patch
"@brightweblabs/module-crm": patch
"@brightweblabs/app-shell": patch
---

Use one Projects listing/statistics implementation for public and HTTP consumers, including dashboard attention filters and compatibility recovery. Share task draft validation and calendar-date conversion between creation surfaces, and remove unused private action wrappers. Read CRM report rows in bounded pages so API response caps cannot silently truncate reports. Remove unused shell styling dependencies.

Project task and milestone collections now page through API caps, reject incomplete or changing reads, and fail explicitly above 10,000 rows. Detail task statistics use the shared aggregate reader.
