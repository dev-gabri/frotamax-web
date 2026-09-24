import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Upload,
  Description,
  Download,
  CheckCircle,
  Error,
  Warning,
  Close
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

interface ValidationError {
  row: number;
  errors: string[];
}

interface ImportResult {
  message: string;
  importedCount: number;
  errors?: ValidationError[];
  validRows?: number;
  totalRows?: number;
}

const DataImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [driversFile, setDriversFile] = useState<File | null>(null);
  const [vehiclesFile, setVehiclesFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'drivers' | 'vehicles') => {
    const file = event.target.files?.[0];
    if (file) {
      if (type === 'drivers') {
        setDriversFile(file);
      } else {
        setVehiclesFile(file);
      }
      setResult(null);
      setErrors([]);
    }
  };

  const handleImport = async (type: 'drivers' | 'vehicles') => {
    const file = type === 'drivers' ? driversFile : vehiclesFile;
    if (!file) return;

    setLoading(true);
    setResult(null);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.requestWithFormData(`/import/${type}`, 'POST', formData);

      setResult(response as ImportResult);
    } catch (error: any) {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
        setResult({
          message: error.response.data.error,
          importedCount: 0,
          validRows: error.response.data.validRows || 0,
          totalRows: error.response.data.totalRows || 0
        });
      } else {
        setResult({
          message: error.response?.data?.error || 'Import failed',
          importedCount: 0
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (type: 'drivers' | 'vehicles') => {
    const filename = type === 'drivers' ? 'drivers_template.csv' : 'vehicles_template.csv';
    const link = document.createElement('a');
    link.href = `/${filename}`;
    link.download = filename;
    link.click();
  };

  const renderFileUploadSection = (type: 'drivers' | 'vehicles') => {
    const file = type === 'drivers' ? driversFile : vehiclesFile;
    const isDrivers = type === 'drivers';

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {isDrivers ? 'Import Drivers' : 'Import Vehicles'}
        </Typography>
        
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Download sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                Step 1: Download Template
              </Typography>
            </Box>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              Download the CSV template with the required fields and format:
            </Typography>
            
            <Button
              variant="outlined"
              startIcon={<Description />}
              onClick={() => downloadTemplate(type)}
              sx={{ mb: 2 }}
            >
              Download {isDrivers ? 'Drivers' : 'Vehicles'} Template
            </Button>
            
            <Typography variant="body2" color="text.secondary">
              Fill in the template with your data following the format shown in the example rows.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Upload sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                Step 2: Upload Your CSV File
              </Typography>
            </Box>
            
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileChange(e, type)}
              style={{ display: 'none' }}
              id={`${type}-file-input`}
            />
            
            <label htmlFor={`${type}-file-input`}>
              <Button
                variant="outlined"
                component="span"
                startIcon={<Upload />}
                sx={{ mb: 2 }}
              >
                Select CSV File
              </Button>
            </label>
            
            {file && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Selected file: <strong>{file.name}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Size: {(file.size / 1024).toFixed(2)} KB
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircle sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                Step 3: Import Data
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              onClick={() => handleImport(type)}
              disabled={!file || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Upload />}
              sx={{ mb: 2 }}
            >
              {loading ? 'Importing...' : `Import ${isDrivers ? 'Drivers' : 'Vehicles'}`}
            </Button>
            
            {loading && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Processing your file...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Result
              </Typography>
              
              {result.importedCount > 0 ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body1">
                    {result.message}
                  </Typography>
                  <Typography variant="body2">
                    Successfully imported {result.importedCount} {type}
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body1">
                    {result.message}
                  </Typography>
                  {result.totalRows && (
                    <Typography variant="body2">
                      Found {result.totalRows} rows, {result.validRows} valid
                    </Typography>
                  )}
                </Alert>
              )}
              
              {errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      Validation Errors ({errors.length} rows)
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setShowErrorDialog(true)}
                      startIcon={<Warning />}
                    >
                      View Details
                    </Button>
                  </Box>
                  
                  <List dense>
                    {errors.slice(0, 3).map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Error color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Row ${error.row}`}
                          secondary={error.errors.join(', ')}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  {errors.length > 3 && (
                    <Typography variant="body2" color="text.secondary">
                      ... and {errors.length - 3} more errors
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Import
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          <strong>Important:</strong> This is a temporary page for initial data population.
        </Typography>
        <Typography variant="body2">
          Use this tool to import your existing drivers and vehicles data via CSV files.
          Make sure to download and fill the templates correctly to avoid errors.
        </Typography>
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab 
            label="Drivers Import" 
            icon={<Description />}
            iconPosition="start"
          />
          <Tab 
            label="Vehicles Import" 
            icon={<Description />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {activeTab === 0 && renderFileUploadSection('drivers')}
      {activeTab === 1 && renderFileUploadSection('vehicles')}

      <Dialog
        open={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Validation Errors</Typography>
            <IconButton onClick={() => setShowErrorDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <List>
            {errors.map((error, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <Error color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Row ${error.row}`}
                    secondary={
                      <Box>
                        {error.errors.map((err, errIndex) => (
                          <Chip
                            key={errIndex}
                            label={err}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ mr: 1, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    }
                  />
                </ListItem>
                {index < errors.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowErrorDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataImportPage;