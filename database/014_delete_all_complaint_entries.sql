/* 014 - Delete ALL complaint entries (keeps logins and master data)
   Clears: applications, forwards, reforwards, remarks, closures.
   Keeps : Tbl_UserLogin, all Mst_* tables, views.
   IRREVERSIBLE - take a backup first. */

USE JanshikayatDB;
GO

-- Row counts before
SELECT 'Details' T, COUNT(*) Cnt FROM Tbl_Applicant_Details
UNION ALL SELECT 'Forward',   COUNT(*) FROM Tbl_Applicant_Forward
UNION ALL SELECT 'Reforward', COUNT(*) FROM Tbl_Applicant_Reforward
UNION ALL SELECT 'Remarks',   COUNT(*) FROM Tbl_Applicant_Remarks
UNION ALL SELECT 'Closure',   COUNT(*) FROM Tbl_Applicant_Closure
UNION ALL SELECT 'FwdDetailsOld', COUNT(*) FROM tbl_Application_Forwarded_details;
GO

BEGIN TRY
    BEGIN TRAN;

    -- children first (FKs point to Tbl_Applicant_Details)
    DELETE FROM Tbl_Applicant_Reforward;          -- self-referencing; single DELETE is fine
    DELETE FROM Tbl_Applicant_Remarks;
    DELETE FROM Tbl_Applicant_Closure;
    DELETE FROM Tbl_Applicant_Forward;
    DELETE FROM tbl_Application_Forwarded_details;
    DELETE FROM Tbl_Applicant_Details;

    -- restart IDs at 1
    DBCC CHECKIDENT ('Tbl_Applicant_Reforward', RESEED, 0);
    DBCC CHECKIDENT ('Tbl_Applicant_Remarks', RESEED, 0);
    DBCC CHECKIDENT ('Tbl_Applicant_Closure', RESEED, 0);
    DBCC CHECKIDENT ('Tbl_Applicant_Forward', RESEED, 0);
    DBCC CHECKIDENT ('Tbl_Applicant_Details', RESEED, 0);

    COMMIT;
    PRINT 'All complaint entries deleted.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT 'FAILED - rolled back: ' + ERROR_MESSAGE();
END CATCH;
GO

-- Row counts after (should all be 0)
SELECT 'Details' T, COUNT(*) Cnt FROM Tbl_Applicant_Details
UNION ALL SELECT 'Forward',   COUNT(*) FROM Tbl_Applicant_Forward
UNION ALL SELECT 'Reforward', COUNT(*) FROM Tbl_Applicant_Reforward
UNION ALL SELECT 'Remarks',   COUNT(*) FROM Tbl_Applicant_Remarks
UNION ALL SELECT 'Closure',   COUNT(*) FROM Tbl_Applicant_Closure;
GO
