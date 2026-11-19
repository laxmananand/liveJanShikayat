/* Removes the Home department (Mst_Departments, DepartmentName 'Home', id 20) so it is no longer listed under the
   "Department" category in the forward popup, and a forward to it is refused (the forward check needs the row).

   It also leaves every other list built from Mst_Departments. The DEPT-HOME login is not changed.

   To put it back:
     INSERT INTO dbo.Mst_Departments (DepartmentId, DepartmentName, email, email2)
     VALUES (20, 'Home', 'secy-home-bih@nic.in', NULL);

   Safe to run more than once.

   No USE line: connect to the app database first.
     sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 018_remove_home_department.sql */
SET NOCOUNT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Mst_Departments', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

-- What is removed, for the record
SELECT * FROM dbo.Mst_Departments WHERE LTRIM(RTRIM(DepartmentName)) = 'Home';

DELETE FROM dbo.Mst_Departments WHERE LTRIM(RTRIM(DepartmentName)) = 'Home';
PRINT CONCAT('018 done: ', @@ROWCOUNT, ' row(s) removed.');
GO
SET NOEXEC OFF;
GO
