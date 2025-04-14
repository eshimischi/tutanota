use crate::bindings::file_client::{FileClient, FileClientError};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default, Debug)]
pub struct TestFileClient {
	data: Mutex<HashMap<String, Vec<u8>>>,
}

impl FileClient for TestFileClient {
	fn persist_content(&self, name: String, content: Vec<u8>) -> Result<(), FileClientError> {
		let mut data_lock = self.data.lock().map_err(|_e| FileClientError::Fatal)?;
		data_lock.insert(name, content);
		Ok(())
	}

	fn read_content(&self, name: String) -> Result<Vec<u8>, FileClientError> {
		let data_lock = self.data.lock().map_err(|_e| FileClientError::Fatal)?;
		data_lock
			.get(&name)
			.cloned()
			.ok_or(FileClientError::NotFound)
	}
}
