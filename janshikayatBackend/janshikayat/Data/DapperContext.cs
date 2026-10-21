using Microsoft.Extensions.Configuration;
using Microsoft.Data.SqlClient;
using System.Data;
namespace janshikayat.Data
{
    public class DapperContext
    {
        private readonly IConfiguration _configuration;

        public DapperContext(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public IDbConnection CreateConnection()
        {
            return new SqlConnection(
                _configuration.GetConnectionString("CMSConStr"));
        }
       
    }
}
