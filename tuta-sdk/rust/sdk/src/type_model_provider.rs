use crate::bindings::file_client::FileClient;
use crate::bindings::rest_client::RestClient;
use crate::metamodel::TypeModel;
use crate::TypeRef;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Arc;

// TODO: Change `AppName` into an enum of strings that is generated from the model
/// The name of an app in the backend
pub type AppName = &'static str;
pub type TypeId = u64;
pub type AttributeId = u64;

// Reads all provided type models into a map.
// Should be able to do it without a provided list, but it's much more work.
// Another improvement could be to have more efficient representation in the binary
macro_rules! read_type_models {
    ($($app_name:literal), +) => {{
        use ::std::collections::HashMap;
        let mut map = HashMap::new();

        $(
            let json = include_str!(concat!("type_models/", $app_name, ".json"));
            let model = ::serde_json::from_str::<HashMap<TypeId, TypeModel>>(&json)
                .expect(concat!("Could not parse type model ", $app_name));
            map.insert($app_name, model);
        )*

        map
    }}
}

static CLIENT_TYPE_MODEL: std::sync::LazyLock<HashMap<AppName, HashMap<TypeId, TypeModel>>> =
	std::sync::LazyLock::new(|| {
		read_type_models![
			"accounting",
			"base",
			"gossip",
			"monitor",
			"storage",
			"sys",
			"tutanota",
			"usage"
		]
	});

/// Contains a map between backend apps and entity/instance types within them
pub struct TypeModelProvider {
	pub client_app_models: &'static HashMap<AppName, HashMap<TypeId, TypeModel>>,
	pub server_app_models: Cow<'static, HashMap<AppName, HashMap<TypeId, TypeModel>>>,
	file_client: Arc<dyn FileClient>,
	rest_client: Arc<dyn RestClient>,
}

impl TypeModelProvider {
	pub fn new(
		rest_client: Arc<dyn RestClient>,
		file_client: Arc<dyn FileClient>,
	) -> TypeModelProvider {
		TypeModelProvider {
			client_app_models: &CLIENT_TYPE_MODEL,
			server_app_models: Cow::Borrowed(&CLIENT_TYPE_MODEL),
			rest_client,
			file_client,
		}
	}

	pub fn resolve_client_type_ref(&self, type_ref: &TypeRef) -> Option<&TypeModel> {
		let app_map = self.client_app_models.get(type_ref.app)?;
		app_map.get(&type_ref.type_id)
	}

	pub fn resolve_server_type_ref(&self, type_ref: &TypeRef) -> Option<&TypeModel> {
		let app_map = self.client_app_models.get(type_ref.app)?;
		app_map.get(&type_ref.type_id)
	}
}

#[cfg(test)]
mod tests {
	use super::Arc;
	use crate::bindings::test_file_client::TestFileClient;
	use crate::bindings::test_rest_client::TestRestClient;
	use crate::type_model_provider::TypeModelProvider;

	#[test]
	fn read_type_model_only_once() {
		let first_type_model = TypeModelProvider::new(
			Arc::new(TestRestClient::default()),
			Arc::new(TestFileClient::default()),
		);

		let second_type_model = TypeModelProvider::new(
			Arc::new(TestRestClient::default()),
			Arc::new(TestFileClient::default()),
		);

		assert!(std::ptr::eq(
			first_type_model.client_app_models,
			second_type_model.client_app_models
		));
	}
}
