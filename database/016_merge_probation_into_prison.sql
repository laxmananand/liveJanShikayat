/* Merges the Probation branch into Prison (Home category).

   1. Probation's complaint types (Mst_Complain_Sub_Type, Complain_Id 7) move to Prison (Complain_Id 3), so the
      forward popup lists Prison's own types followed by Probation's. Probation's "अन्य" is not moved: Prison
      already has one. The API lists "अन्य" last (MasterData.GetComplainSubTypes).
   2. Probation (Mst_Branch.Complain_id 7) is set Is_Active = 0: it leaves the branch dropdown and no new
      forward can be sent to it.

   Complaints already forwarded to Probation keep their branch and type (labels are stored on the forward),
   and the Probation login stays active so it can still see and finish them.

   One transaction: all or nothing. Safe to run more than once.

   No USE line: connect to the app database first.
     sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 016_merge_probation_into_prison.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Mst_Complain_Sub_Type', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Branch WHERE Complain_id = 3 AND Branch_Eng = 'Prison')
       OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Branch WHERE Complain_id = 7 AND Branch_Eng = 'Probation')
        THROW 50001, 'Mst_Branch 3 is not Prison or 7 is not Probation. Nothing was changed.', 1;

    UPDATE dbo.Mst_Complain_Sub_Type
    SET Complain_Id = 3
    WHERE Complain_Id = 7
      AND LTRIM(RTRIM(Sub_Type)) <> N'अन्य'
      AND LTRIM(RTRIM(Sub_Type)) NOT IN (SELECT LTRIM(RTRIM(Sub_Type)) FROM dbo.Mst_Complain_Sub_Type WHERE Complain_Id = 3);
    DECLARE @moved int = @@ROWCOUNT;

    UPDATE dbo.Mst_Branch SET Is_Active = 0 WHERE Complain_id = 7 AND Is_Active = 1;
    DECLARE @hidden int = @@ROWCOUNT;

    COMMIT TRANSACTION;
    PRINT CONCAT('016 done: ', @moved, ' complaint type(s) moved to Prison; Probation ',
                 IIF(@hidden = 1, 'removed from the branch list.', 'was already removed.'));
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('016 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

-- Prison's types as the popup will list them
SELECT Sub_Type_id, Sub_Type
FROM dbo.Mst_Complain_Sub_Type
WHERE Complain_Id = 3
ORDER BY CASE WHEN LTRIM(RTRIM(Sub_Type)) = N'अन्य' THEN 1 ELSE 0 END, Sub_Type_id;
SELECT Complain_id, Branch_Eng, Is_Active FROM dbo.Mst_Branch WHERE Complain_id IN (3, 7);
GO
SET NOEXEC OFF;
GO
