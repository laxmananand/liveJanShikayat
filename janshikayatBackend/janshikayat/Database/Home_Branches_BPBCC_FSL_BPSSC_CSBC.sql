-- Four more branches under the Home category (Mst_Category.Category_Id = 1): 16 BPBCC, 17 FSL, 18 BPSSC, 19 CSBC.
-- Each gets one complaint type ("अन्य") so it can be forwarded to; add specific types to Mst_Complain_Sub_Type as they are decided.
-- No Tbl_UserLogin is mapped here: until a login has Branch_Id set, only Admin sees forwards to these branches.
-- Run after Category_Branch_Mapping.sql. Safe to re-run: rows are upserted.
-- Run with sqlcmd -f 65001 so the Hindi text is read correctly.

USE Jansikayat_DB;
GO

MERGE dbo.Mst_Branch AS t
USING (VALUES (16, N'Bihar Police Building Construction Corporation', N'बिहार पुलिस भवन निर्माण निगम'),
              (17, N'FSL',   N'विधि विज्ञान प्रयोगशाला'),
              (18, N'BPSSC', N'बिहार पुलिस अवर सेवा आयोग'),
              (19, N'CSBC',  N'केंद्रीय चयन पर्षद (सिपाही भर्ती)')
      ) AS s(Complain_id, Branch_Eng, Branch_Hindi)
ON t.Complain_id = s.Complain_id
WHEN MATCHED THEN UPDATE SET Branch_Eng = s.Branch_Eng, Branch_Hindi = s.Branch_Hindi, Is_Active = 1, Home_Categ = 1
WHEN NOT MATCHED THEN INSERT (Complain_id, Branch_Eng, Branch_Hindi, Is_Active, Home_Categ)
                      VALUES (s.Complain_id, s.Branch_Eng, s.Branch_Hindi, 1, 1);
GO

INSERT INTO dbo.Mst_Complain_Sub_Type (Complain_Id, Sub_Type)
SELECT b.Complain_id, N'अन्य'
FROM dbo.Mst_Branch b
WHERE b.Complain_id IN (16, 17, 18, 19)
  AND NOT EXISTS (SELECT 1 FROM dbo.Mst_Complain_Sub_Type s WHERE s.Complain_Id = b.Complain_id);
GO

-- Verify
SELECT Complain_id, Branch_Eng, Branch_Hindi, Is_Active, Home_Categ FROM dbo.Mst_Branch WHERE Home_Categ = 1 ORDER BY Complain_id;
SELECT Sub_Type_id, Complain_Id, Sub_Type FROM dbo.Mst_Complain_Sub_Type WHERE Complain_Id IN (16, 17, 18, 19) ORDER BY Complain_Id;
GO
